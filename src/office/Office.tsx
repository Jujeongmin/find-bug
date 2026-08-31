import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useI18n } from "../i18n";
import { EngineStage } from "../engine/EngineStage";
import { officeScene, MACHINES, type MachineId } from "./scene";
import { homeScene } from "../home/scene";
import { ENGINE_SCENES } from "../stages/registry";
import { sfx } from "../audio/sfx";

const DAYS = 5;

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

const clock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

/** how much a defect in this build costs if it ships */
type Severity = "low" | "normal" | "critical";

const SEVERITY_COST: Record<Severity, number> = {
  low: 0.25,
  normal: 0.5,
  critical: 1,
};

/** a defect caught but never walked over to the developer is never fixed */
const LATE_COST = 0.2;

/**
 * Tiredness, 0 to 3. A late finish costs a night of it, and every point pushes
 * tomorrow's start later — so working past the evening is a loan against the
 * next day rather than free extra time.
 */
const MAX_FATIGUE = 3;
const FATIGUE_START_COST = 20;
/** finishing after this leaves you tired */
const LATE_FINISH = 16 * 60 + 30;

interface Assignment {
  machine: MachineId;
  sceneId: string;
  severity: Severity;
  /** null until the player has verified it */
  result: null | "caught" | "missed";
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
  const [late, setLate] = useState(0);
  const [shipped_, setShipped_] = useState<Severity[]>([]);
  const [place, setPlace] = useState<"office" | "home">("office");
  const [fatigue, setFatigue] = useState(0);
  /** one restful thing per evening */
  const [restedTonight, setRestedTonight] = useState(false);

  // one clock for the whole day, ticking through the office and the builds
  // alike; goHomeRef keeps the timer from closing over a stale day
  const goHomeRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (shipped || place === "home") return;
    const id = setInterval(() => {
      setMinutes((m) => {
        if (m >= DAY_END) return m;
        const next = m + MINUTES_PER_SECOND / 4;
        if (next >= DAY_END) goHomeRef.current();
        return Math.min(next, DAY_END);
      });
    }, 250);
    return () => clearInterval(id);
  }, [shipped]);

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

  const goHome = () => {
    // anything still unverified ships as-is
    const unseen = assignments.filter((a) => a.result === null);
    setMissed((n) => n + unseen.length);
    setShipped_((v) => [...v, ...unseen.map((a) => a.severity)]);
    // a defect the developer never heard about does not get fixed
    setLate((n) => n + pending.length);
    setPending([]);
    // a long day costs a night of sleep, whether or not it was productive
    if (minutes >= LATE_FINISH) setFatigue((f) => Math.min(MAX_FATIGUE, f + 1));
    sfx.play("click");
    setRunning(null);
    setNote(null);
    setPlace("home");
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
    setMinutes(DAY_START + fatigue * FATIGUE_START_COST);
    setRestedTonight(false);
    setPlace("office");
    setNote(null);
  };
  goHomeRef.current = goHome;

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

  const onHomeStation = (id: string) => {
    if (id === "bed") return sleep();
    if (id === "sofa") {
      if (restedTonight) return setNote(t("home.alreadyRested"));
      setRestedTonight(true);
      setFatigue((f) => Math.max(0, f - 1));
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
    if (id === "frontDoor") return setNote(t("home.notYet"));
  };

  const onStation = (id: string) => {
    if (id === "exitDoor") {
      goHome();
      return;
    }
    if (id === "dev") {
      if (pending.length) {
        setDelivered((n) => n + pending.length);
        setPending([]);
        setNote(tp("office.dev.handoff", { n: String(pending.length) }));
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
    const cost =
      shipped_.reduce((sum, sv) => sum + SEVERITY_COST[sv], 0) + late * LATE_COST;
    const rating = Math.max(1, Math.round((5 - cost) * 10) / 10);
    return (
      <div className="wb-root wb-ship">
        <h1>{t("office.shipTitle")}</h1>
        <div className="wb-rating">
          <span className="wb-stars">
            {"★".repeat(Math.round(rating))}
            {"☆".repeat(5 - Math.round(rating))}
          </span>
          <b>{rating.toFixed(1)}</b>
        </div>
        <p className="wb-tally">
          {tp("office.tally", { caught: String(caught), total: String(total) })}
          <br />
          {tp("office.tallyDetail", {
            delivered: String(delivered),
            late: String(late),
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
        onClear={() => finish("caught")}
        onExit={() => finish("missed")}
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
          "--sky-top": sky.top,
          "--sky-bottom": sky.bottom,
        } as CSSProperties
      }
    >
      {place === "home" ? (
        <EngineStage
          key={`home-${day}`}
          scene={homeScene}
          mode="play"
          header={
            <div className="wb-header">
              <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
                ←
              </button>
              <span className="wb-build">{tp("home.evening", { n: String(day) })}</span>
              <span className="office-fatigue">
                {t("home.fatigue")} {"●".repeat(fatigue)}
                {"○".repeat(MAX_FATIGUE - fatigue)}
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
        scene={officeScene}
        mode="play"
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

      {note && (
        <div className="modal-backdrop" onClick={() => setNote(null)}>
          <div className="modal">
            <p>{note}</p>
            <button className="btn-primary" onClick={() => setNote(null)}>
              {t("wb.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
