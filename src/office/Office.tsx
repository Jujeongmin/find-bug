import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useI18n } from "../i18n";
import { EngineStage } from "../engine/EngineStage";
import type { SceneSpec } from "../engine/types";
import { officeScene, MACHINES, type MachineId } from "./scene";
import { homeScene } from "../home/scene";
import { streetScene } from "../street/scene";
import { ENGINE_SCENES } from "../stages/registry";
import { sfx } from "../audio/sfx";
import { shipRating, totalStake, type Severity } from "./rating";
import { HAS_KEYBOARD } from "../components/useSpaceCloses";

/**
 * Days to ship. Five left no room to earn: the three things on sale come to
 * 380 and a perfect day pays 140, so equipment arrived just as the run ended.
 */
const DAYS = 10;

/** the working day, 09:00 to 18:00 */
const DAY_START = 9 * 60;
const DAY_END = 18 * 60;

/**
 * Game minutes per real second. The clock runs while the world does, so
 * nothing has to be charged for explicitly: crossing the room costs what
 * crossing the room takes, and a build costs what it takes to inspect.
 */
const MINUTES_PER_SECOND = 2;

/** things the developer says when there is nothing more pressing */
const IDLE_LINES = 5;

/**
 * ?place=office (or home, street) opens the day in that room.
 *
 * Dev only, and it exists because looking at the office meant walking there
 * from bed every time — three minutes of held arrow keys to check whether a
 * chair had moved four pixels.
 */
const START_PLACE = (() => {
  const asked = new URLSearchParams(location.search).get("place");
  return asked === "office" || asked === "street" ? asked : "home";
})();

/**
 * Sky through the window, from morning to the end of the day. The header
 * clock is a number; this is the same fact you can feel without reading.
 */
const SKY: { at: number; top: string; bottom: string }[] = [
  { at: 9 * 60, top: "#8fc6ef", bottom: "#d9ecfa" },
  { at: 12 * 60, top: "#63aee8", bottom: "#bfe0f6" },
  { at: 15 * 60, top: "#7bb6e0", bottom: "#e6dcc2" },
  { at: 17 * 60, top: "#d98f52", bottom: "#f2c98a" },
  { at: 18 * 60, top: "#5b4a72", bottom: "#c07a5c" },
];

const mix = (a: string, b: string, t: number) => {
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
};

function skyAt(minutes: number) {
  let i = 0;
  while (i < SKY.length - 2 && minutes > SKY[i + 1].at) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const t = Math.max(0, Math.min(1, (minutes - a.at) / (b.at - a.at)));
  return { top: mix(a.top, b.top, t), bottom: mix(a.bottom, b.bottom, t) };
}

/**
 * How lit the street lamps are: nothing in daylight, full once the light has
 * gone. They used to burn at nine in the morning.
 */
const lampAt = (m: number) => Math.max(0, Math.min(1, (m - 16 * 60) / 120));

/** the same scene with the player put somewhere else to start */
function withPlayerAt(scene: SceneSpec, x: number, y: number): SceneSpec {
  return {
    ...scene,
    objects: scene.objects.map((o) => (o.id === "player" ? { ...o, x, y } : o)),
  };
}

const clock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;


/**
 * Condition, 0 to 3, and higher is better.
 *
 * It was tiredness, where lower was better — so buying a coffee read as
 * "fatigue -1", which looks like a penalty on the thing you just paid for. A
 * stat you want to raise is one the player can act on without translating.
 *
 * Every missing point pushes tomorrow's start later, so finishing late is a
 * loan against the next day rather than free extra time.
 */
const MAX_CONDITION = 3;
const CONDITION_START_COST = 20;
/** finishing after this costs a point of condition */
const LATE_FINISH = 16 * 60 + 30;

/** what a coffee on the way in costs, and what it is worth */
const COFFEE_MINUTES = 15;

/** what a confirmed defect is worth once the developer has it */
const BOUNTY: Record<Severity, number> = { low: 20, normal: 40, critical: 80 };

/**
 * Things you can buy, and where. Each one changes a number the player has
 * already felt go against them: the magnifier makes small faults visible, the
 * chair buys an hour before a late finish costs condition, and the alarm
 * hands back half of what a bad night took.
 */
type ItemId = "magnifier" | "chair" | "alarm";

const CATALOGUE: {
  id: ItemId;
  cost: number;
  where: "office" | "home";
}[] = [
  { id: "magnifier", cost: 120, where: "office" },
  { id: "chair", cost: 160, where: "office" },
  { id: "alarm", cost: 100, where: "home" },
];

/** the good chair buys this much slack before a late finish costs anything */
const CHAIR_GRACE = 60;
/** the alarm clock starts the day this much earlier */
const ALARM_MINUTES = 30;

interface Assignment {
  machine: MachineId;
  sceneId: string;
  severity: Severity;
  /** null until the player has verified it */
  result: null | "caught" | "missed";
  /**
   * Which defect is in this build. Decided the first time the machine is
   * opened and kept from then on, so stepping away and coming back finds the
   * same build rather than a freshly rolled one.
   */
  bugId: string | null;
}

/**
 * Three builds a day, one per machine. Each day holds exactly one of each
 * severity, and which machine carries the critical one rotates — so there is
 * always a build worth reaching first, and it is never the same walk twice.
 */
const SEVERITIES: Severity[] = ["normal", "low", "critical"];

function assignDay(day: number): Assignment[] {
  const pool = [...ENGINE_SCENES];
  return MACHINES.map((machine, i) => ({
    machine,
    sceneId: pool[(day * 3 + i) % pool.length].id,
    severity: SEVERITIES[(i + day) % SEVERITIES.length],
    result: null,
    bugId: null,
  }));
}

/**
 * The QA floor, replacing the stage-select grid.
 *
 * The verification itself is unchanged — the same scene, the same planted
 * defect, the same report. What changes is the frame around it: builds are
 * queued on machines you walk to, a day holds only so many, and the ship date
 * arrives whether or not the queue is clear.
 */
export function Office({ onExit }: { onExit: () => void }) {
  const { t, tp } = useI18n();
  const [day, setDay] = useState(1);
  const [assignments, setAssignments] = useState<Assignment[]>(() => assignDay(1));
  const [running, setRunning] = useState<Assignment | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [shipped, setShipped] = useState(false);
  const [caught, setCaught] = useState(0);
  const [missed, setMissed] = useState(0);
  const [minutes, setMinutes] = useState(DAY_START);
  /** how many times the developer has been spoken to, so idle lines rotate */
  const [talks, setTalks] = useState(0);
  /** the last build signed off, so the developer can react to it once */
  const [lastResult, setLastResult] = useState<null | "caught" | "missed">(null);
  /** caught today but not yet handed to the developer */
  const [pending, setPending] = useState<Assignment[]>([]);
  const [delivered, setDelivered] = useState(0);
  /** caught, but the day ended before it reached the developer */
  const [late, setLate] = useState<Severity[]>([]);
  const [shipped_, setShipped_] = useState<Severity[]>([]);
  /**
   * The day opens at home, so leaving for work is something the player does
   * rather than something that has already happened when they arrive.
   */
  const [place, setPlace] = useState<"office" | "home" | "street">(START_PLACE);
  /** true once the day has been signed off, which is what makes the bed work */
  const [dayOver, setDayOver] = useState(false);
  /** one coffee per commute */
  const [hadCoffee, setHadCoffee] = useState(false);
  const [condition, setCondition] = useState(MAX_CONDITION);
  /** one restful thing per evening */
  const [restedTonight, setRestedTonight] = useState(false);
  /** pay, earned by handing defects over, spent on equipment */
  const [pay, setPay] = useState(0);
  const [owned, setOwned] = useState<ItemId[]>([]);
  const [shop, setShop] = useState<null | "office" | "home">(null);
  /** where the player was standing on the office floor, across a build */
  const [officeAt, setOfficeAt] = useState<{ x: number; y: number } | null>(null);

  // one clock for the whole day, ticking through the office and the builds
  // alike; goHomeRef keeps the timer from closing over a stale day
  const goHomeRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (shipped || dayOver || place === "home") return;
    const id = setInterval(() => {
      setMinutes((m) => {
        if (m >= DAY_END) return m;
        const next = m + MINUTES_PER_SECOND / 4;
        if (next >= DAY_END) goHomeRef.current();
        return Math.min(next, DAY_END);
      });
    }, 250);
    return () => clearInterval(id);
    // `place` belongs in here: the effect read it once at mount and then never
    // again, so the clock ran on whatever the game had opened with. Starting the
    // day at home turned that from "time passes while you sleep" into "time
    // never passes at all".
  }, [shipped, place, dayOver]);

  /**
   * The office floor, with the player put back where they were standing.
   * Walking to a machine and stepping out of the build used to drop them in
   * the middle of the room, so a second look cost the whole walk again.
   */
  const officeHere = useMemo(
    () => (officeAt ? withPlayerAt(officeScene, officeAt.x, officeAt.y) : officeScene),
    [officeAt]
  );

  /**
   * You arrive where you came in. Waking up puts you beside the bed; coming
   * back from the street puts you inside your own front door, and the street
   * puts you at whichever end you stepped out of.
   */
  const homeHere = useMemo(
    () => withPlayerAt(homeScene, dayOver ? 272 : 132, dayOver ? 545 : 258),
    [dayOver]
  );
  const streetHere = useMemo(
    () => withPlayerAt(streetScene, 180, dayOver ? 250 : 540),
    [dayOver]
  );

  const morningLine = () =>
    day === 1
      ? t("home.morningFirst")
      : tp("home.morning", { n: String(day) });
  // said once on the first morning too, not only on the ones you wake up to
  useEffect(() => {
    setNote(morningLine());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scenesById = useMemo(
    () => Object.fromEntries(ENGINE_SCENES.map((s) => [s.id, s])),
    []
  );

  const finish = (result: "caught" | "missed") => {
    if (!running) return;
    setLastResult(result);
    if (result === "caught") setCaught((n) => n + 1);
    else setMissed((n) => n + 1);
    setAssignments((as) =>
      as.map((a) => (a.machine === running.machine ? { ...a, result } : a))
    );
    setRunning(null);
  };

  /**
   * Knocking off. Everything the day was going to cost is settled here — the
   * office is shut behind you — and then you are on the pavement outside it,
   * because the way home is the way you came.
   */
  const clockOff = () => {
    // anything still unverified ships as-is
    const unseen = assignments.filter((a) => a.result === null);
    setMissed((n) => n + unseen.length);
    setShipped_((v) => [...v, ...unseen.map((a) => a.severity)]);
    // a defect the developer never heard about does not get fixed
    setLate((v) => [...v, ...pending.map((a) => a.severity)]);
    setPending([]);
    // a long day costs a night of sleep, whether or not it was productive
    const lateFrom = LATE_FINISH + (owned.includes("chair") ? CHAIR_GRACE : 0);
    if (minutes >= lateFrom) setCondition((c) => Math.max(0, c - 1));
    sfx.play("click");
    setRunning(null);
    setNote(null);
    // tomorrow starts at the door, not at yesterday's desk
    setOfficeAt(null);
    setDayOver(true);
    setPlace("street");
  };

  /** the bed, and the only way into tomorrow */
  const sleep = () => {
    if (day >= DAYS) {
      setShipped(true);
      return;
    }
    sfx.play("click");
    setDay((d) => d + 1);
    setAssignments(assignDay(day + 1));
    setMinutes(
      DAY_START +
        (MAX_CONDITION - condition) * CONDITION_START_COST -
        (owned.includes("alarm") ? ALARM_MINUTES : 0)
    );
    setRestedTonight(false);
    setHadCoffee(false);
    setDayOver(false);
    setPlace("home");
    // the walk in is where the coffee is, and the fifteen minutes it costs is
    // the morning's one real decision — so the player has to make it, every
    // morning, by walking out of their own front door
    setNote(tp("home.morning", { n: String(day + 1) }));
  };
  goHomeRef.current = clockOff;

  /**
   * What the developer says, most pressing first. Reacting to the build you
   * just signed off matters more than the day, and the day matters more than
   * small talk — otherwise the same line comes back and they stop reading it.
   */
  const devLine = () => {
      if (day === 1 && talks === 0) return "office.dev.intro";
    if (pending.length) return "office.dev.waiting";
    if (lastResult === "caught") return "office.dev.caught";
    if (lastResult === "missed") return "office.dev.missed";
    if (left === 0) return "office.dev.allDone";
    if (day >= DAYS) return "office.dev.lastDay";
    return `office.dev.idle${talks % IDLE_LINES}`;
  };

  const buy = (item: ItemId, cost: number) => {
    if (owned.includes(item) || pay < cost) return;
    setPay((p) => p - cost);
    setOwned((o) => [...o, item]);
    sfx.play("success");
  };

  const onStreetStation = (id: string) => {
    if (id === "officeDoor") {
      if (dayOver) return setNote(t("street.shut"));
      sfx.play("click");
      setPlace("office");
      setNote(null);
      return;
    }
    if (id === "homeDoor") {
      sfx.play("click");
      setNote(null);
      setPlace("home");
      return;
    }
    if (id === "coffee") {
      if (dayOver) return setNote(t("street.shut"));
      if (hadCoffee) return setNote(t("street.hadCoffee"));
      setHadCoffee(true);
      setCondition((c) => Math.min(MAX_CONDITION, c + 1));
      setMinutes((m) => Math.min(DAY_END, m + COFFEE_MINUTES));
      sfx.play("pick");
      return setNote(tp("street.gotCoffee", { n: String(COFFEE_MINUTES) }));
    }
  };

  const onHomeStation = (id: string) => {
    if (id === "bed") {
      if (!dayOver) return setNote(t("home.tooEarly"));
      return sleep();
    }
    if (id === "sofa") {
      if (restedTonight) return setNote(t("home.alreadyRested"));
      setRestedTonight(true);
      setCondition((c) => Math.min(MAX_CONDITION, c + 1));
      sfx.play("pick");
      return setNote(t("home.rested"));
    }
    if (id === "journal") {
      return setNote(
        tp("home.journalLine", {
          n: String(day),
          left: String(DAYS - day),
          shipped: String(shipped_.length),
        })
      );
    }
    if (id === "parcel") {
      sfx.play("click");
      setShop("home");
      return;
    }
    if (id === "frontDoor") {
      if (dayOver) return setNote(t("home.notYet"));
      sfx.play("click");
      setNote(null);
      setPlace("street");
      return;
    }
  };

  const onStation = (id: string) => {
    if (id === "exitDoor") {
      clockOff();
      return;
    }
    if (id === "supplyForm") {
      sfx.play("click");
      setShop("office");
      return;
    }
    if (id === "dev") {
      if (pending.length) {
        const earned = pending.reduce((sum, a) => sum + BOUNTY[a.severity], 0);
        setPay((p) => p + earned);
        setDelivered((n) => n + pending.length);
        setPending([]);
        setNote(
          tp("office.dev.handoff", {
            n: String(pending.length),
            pay: String(earned),
          })
        );
        setTalks((n) => n + 1);
        setLastResult(null);
        return;
      }
      setNote(t(devLine()));
      setTalks((n) => n + 1);
      setLastResult(null);
      return;
    }
    const a = assignments.find((x) => x.machine === id);
    if (!a) return;
    if (a.result !== null) {
      setNote(t("office.alreadyDone"));
      return;
    }
    setRunning(a);
  };

  if (shipped) {
    const total = caught + missed;
    const rating = shipRating(shipped_, late, totalStake(DAYS, SEVERITIES));
    return (
      <div className="wb-root wb-ship">
        <h1>{t("office.shipTitle")}</h1>
        <div className="wb-rating">
          <span className="wb-stars">
            {/* floored, so five stars means the build shipped clean and
                nothing rounds its way up to a perfect score */}
            {"★".repeat(Math.floor(rating))}
            {"☆".repeat(5 - Math.floor(rating))}
          </span>
          <b>{rating.toFixed(1)}</b>
        </div>
        <p className="wb-tally">
          {tp("office.tally", { caught: String(caught), total: String(total) })}
          <br />
          {tp("office.tallyDetail", {
            delivered: String(delivered),
            late: String(late.length),
            critical: String(shipped_.filter((s2) => s2 === "critical").length),
          })}
        </p>
        <button className="btn-primary" onClick={onExit}>
          {t("wb.backToTitle")}
        </button>
      </div>
    );
  }

  if (running) {
    const scene = scenesById[running.sceneId];
    return (
      <EngineStage
        key={`${day}-${running.machine}`}
        scene={scene}
        stageNo={day}
        title={`${tp("office.buildTitle", { machine: t(`object.${running.machine}`) })} · ${clock(minutes)}`}
        canZoom={owned.includes("magnifier")}
        bugId={running.bugId}
        onBugPicked={(id) =>
          setAssignments((as) =>
            as.map((a) =>
              a.machine === running.machine ? { ...a, bugId: id } : a
            )
          )
        }
        onClear={() => finish("caught")}
        // a wrong report stands, exactly as the briefing says it will
        onFail={() => finish("missed")}
        // stepping away from a machine is not signing the build off. The build
        // keeps its defect and the clock keeps running, which is the only
        // price of walking back and forth.
        onExit={() => setRunning(null)}
      />
    );
  }

  const left = assignments.filter((a) => a.result === null).length;
  const sky = skyAt(minutes);

  return (
    <div
      className="wb-root"
      style={
        {
          "--lamp": String(lampAt(minutes)),
          "--sky-top": sky.top,
          "--sky-bottom": sky.bottom,
        } as CSSProperties
      }
    >
      {place === "street" ? (
        <EngineStage
          key={`street-${day}`}
          scene={streetHere}
          mode="play"
          header={
            <div className="wb-header">
              <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
                ←
              </button>
              <span className="wb-build">{tp("office.day", { n: String(day) })}</span>
              <span className="office-clock">{clock(minutes)}</span>
              <span className="office-condition">
                {t("home.condition")} {"●".repeat(condition)}
                {"○".repeat(MAX_CONDITION - condition)}
              </span>
            </div>
          }
          onStation={onStreetStation}
          onClear={() => {}}
          onExit={onExit}
        />
      ) : place === "home" ? (
        <EngineStage
          key={`home-${day}`}
          scene={homeHere}
          mode="play"
          header={
            <div className="wb-header">
              <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
                ←
              </button>
              <span className="wb-build">
                {tp(dayOver ? "home.evening" : "home.morningHeader", {
                  n: String(day),
                })}
              </span>
              <span className="office-condition">
                {t("home.condition")} {"●".repeat(condition)}
                {"○".repeat(MAX_CONDITION - condition)}
              </span>
            </div>
          }
          onStation={onHomeStation}
          onClear={() => {}}
          onExit={onExit}
        />
      ) : (
      <EngineStage
        key={`office-${day}`}
        scene={officeHere}
        mode="play"
        onPlayerRest={setOfficeAt}
        header={
          <div className="wb-header">
            <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
              ←
            </button>
            <span className="wb-build">{tp("office.day", { n: String(day) })}</span>
            <span className="office-clock">{clock(minutes)}</span>
            <span className="wb-deadline">
              {tp("office.shipIn", { n: String(DAYS - day) })}
            </span>
            <span className="office-pay">{tp("office.pay", { n: String(pay) })}</span>
            <span className="office-queue">
              {assignments.map((a) => (
                <b
                  key={a.machine}
                  className={`q-${a.severity} ${a.result ? "done" : ""}`}
                  title={`${t(`object.${a.machine}`)} · ${t(`office.sev.${a.severity}`)}`}
                >
                  {a.machine.slice(-1)}
                </b>
              ))}
              {pending.length > 0 && (
                <em className="q-pending">{tp("office.pending", { n: String(pending.length) })}</em>
              )}
            </span>
          </div>
        }
        onStation={onStation}
        onClear={() => {}}
        onExit={onExit}
      />
      )}

      {shop && (
        <div className="modal-backdrop" onClick={() => setShop(null)}>
          <div className="modal shop" onClick={(e) => e.stopPropagation()}>
            <h2>{t(`shop.title.${shop}`)}</h2>
            <p className="shop-pay">{tp("office.pay", { n: String(pay) })}</p>
            <div className="shop-list">
              {CATALOGUE.filter((c) => c.where === shop).map((c) => {
                const have = owned.includes(c.id);
                const canAfford = pay >= c.cost;
                return (
                  <button
                    key={c.id}
                    className={`shop-item ${have ? "have" : ""}`}
                    disabled={have || !canAfford}
                    onClick={() => buy(c.id, c.cost)}
                  >
                    <span className="shop-name">{t(`item.${c.id}`)}</span>
                    <span className="shop-desc">{t(`item.${c.id}.desc`)}</span>
                    <em>{have ? t("shop.have") : tp("office.pay", { n: String(c.cost) })}</em>
                  </button>
                );
              })}
            </div>
            <button data-space className="btn-primary" onClick={() => setShop(null)}>
              {t("wb.close")}
            </button>
          </div>
        </div>
      )}

      {note && (
        <div className="modal-backdrop" onClick={() => setNote(null)}>
          <div className="modal">
            <p>{note}</p>
            <button data-space className="btn-primary" onClick={() => setNote(null)}>
              {t("wb.close")}
              {HAS_KEYBOARD && <em className="key-hint">space</em>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
