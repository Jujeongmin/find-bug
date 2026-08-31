import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { EngineStage } from "../engine/EngineStage";
import { officeScene, MACHINES, type MachineId } from "./scene";
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

const clock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

interface Assignment {
  machine: MachineId;
  sceneId: string;
  /** null until the player has verified it */
  result: null | "caught" | "missed";
}

/** three builds a day, one per machine, never the same scene twice in a day */
function assignDay(day: number): Assignment[] {
  const pool = [...ENGINE_SCENES];
  return MACHINES.map((machine, i) => ({
    machine,
    sceneId: pool[(day * 3 + i) % pool.length].id,
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

  // one clock for the whole day, ticking through the office and the builds
  // alike; goHomeRef keeps the timer from closing over a stale day
  const goHomeRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (shipped) return;
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
    setMinutes(DAY_START);
    // anything still unverified ships as-is
    const left = assignments.filter((a) => a.result === null).length;
    setMissed((n) => n + left);
    if (day >= DAYS) {
      setShipped(true);
      return;
    }
    sfx.play("click");
    setRunning(null);
    setDay((d) => d + 1);
    setAssignments(assignDay(day + 1));
    setNote(null);
  };
  goHomeRef.current = goHome;

  /**
   * What the developer says, most pressing first. Reacting to the build you
   * just signed off matters more than the day, and the day matters more than
   * small talk — otherwise the same line comes back and they stop reading it.
   */
  const devLine = () => {
    const left = assignments.filter((a) => a.result === null).length;
    if (day === 1 && talks === 0) return "office.dev.intro";
    if (lastResult === "caught") return "office.dev.caught";
    if (lastResult === "missed") return "office.dev.missed";
    if (left === 0) return "office.dev.allDone";
    if (day >= DAYS) return "office.dev.lastDay";
    return `office.dev.idle${talks % IDLE_LINES}`;
  };

  const onStation = (id: string) => {
    if (id === "exitDoor") {
      goHome();
      return;
    }
    if (id === "dev") {
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
    const rating = Math.max(1, Math.round((5 - missed * 0.4) * 10) / 10);
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

  return (
    <div className="wb-root">
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
            <span className="wb-budget">{tp("office.queue", { n: String(left) })}</span>
          </div>
        }
        onStation={onStation}
        onClear={() => {}}
        onExit={onExit}
      />
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
