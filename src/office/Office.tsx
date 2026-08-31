import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { EngineStage } from "../engine/EngineStage";
import { officeScene, MACHINES, type MachineId } from "./scene";
import { ENGINE_SCENES } from "../stages/registry";
import { sfx } from "../audio/sfx";

const DAYS = 5;

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

  const scenesById = useMemo(
    () => Object.fromEntries(ENGINE_SCENES.map((s) => [s.id, s])),
    []
  );

  const finish = (result: "caught" | "missed") => {
    if (!running) return;
    if (result === "caught") setCaught((n) => n + 1);
    else setMissed((n) => n + 1);
    setAssignments((as) =>
      as.map((a) => (a.machine === running.machine ? { ...a, result } : a))
    );
    setRunning(null);
  };

  const goHome = () => {
    // anything still unverified ships as-is
    const left = assignments.filter((a) => a.result === null).length;
    setMissed((n) => n + left);
    if (day >= DAYS) {
      setShipped(true);
      return;
    }
    sfx.play("click");
    setDay((d) => d + 1);
    setAssignments(assignDay(day + 1));
    setNote(null);
  };

  const onStation = (id: string) => {
    if (id === "exitDoor") {
      goHome();
      return;
    }
    if (id === "dev") {
      setNote(t("office.devLine"));
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
        title={tp("office.buildTitle", { machine: t(`object.${running.machine}`) })}
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
