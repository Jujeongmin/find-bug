import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { EngineStage } from "../engine/EngineStage";
import { Stage04 } from "../stages/stage04/Stage04";
import { stage04 } from "../stages/stage04/bugs";
import { ENGINE_SCENES } from "../stages/registry";
import { generateMutations } from "../engine/generate";
import type { SceneSpec } from "../engine/types";

/**
 * Every build, every defect, on one screen.
 *
 * Playing a build to see one particular fault meant waiting for the office to
 * deal it, and the office deals at random out of a hundred and twenty. Faults
 * that cannot be seen — a picture with no up, a wire nobody notices — are
 * exactly the ones that never came round often enough to check.
 *
 * Both stage components already take a bugId to pin the defect and a playtest
 * flag to name it on screen. All that was missing was the list.
 */

interface Row {
  bugId: string;
  mutator: string;
  target: string;
  category: string;
  subtlety: number;
  desc: string;
}

const STAGE04 = "stage04";

export function DebugLab({ onExit }: { onExit: () => void }) {
  const { t, tp } = useI18n();
  const [sceneId, setSceneId] = useState<string>(ENGINE_SCENES[0].id);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const scene: SceneSpec | null =
    ENGINE_SCENES.find((s) => s.id === sceneId) ?? null;

  const rows: Row[] = useMemo(() => {
    if (sceneId === STAGE04) {
      return stage04.bugPool.map((b) => ({
        bugId: b.id,
        mutator: "—",
        target: b.objectIds.join(" / "),
        category: t(`category.${b.category}`),
        subtlety: 0,
        desc: t(b.descKey),
      }));
    }
    if (!scene) return [];
    return generateMutations(scene).map((m) => ({
      bugId: m.bug.id,
      mutator: m.mutator.id,
      target: m.bug.objectIds
        .map((id) => t(scene.objects.find((o) => o.id === id)?.nameKey ?? id))
        .join(" / "),
      category: t(`category.${m.bug.category}`),
      subtlety: m.bug.subtlety,
      desc: tp(m.bug.descKey, {
        ...m.bug.descParams,
        obj: t(m.bug.descParams.obj ?? ""),
        counter: m.bug.descParams.counter ? t(m.bug.descParams.counter) : "",
      }),
    }));
  }, [sceneId, scene, t, tp]);

  const shown = filter
    ? rows.filter((r) =>
        `${r.bugId} ${r.mutator} ${r.target} ${r.category} ${r.desc}`
          .toLowerCase()
          .includes(filter.toLowerCase())
      )
    : rows;

  if (open) {
    const back = () => setOpen(null);
    if (sceneId === STAGE04) {
      return (
        <Stage04
          key={open}
          bugId={open}
          playtest
          /* the id is mutator:target and runs to thirty characters, which
             wraps the stage header and folds the report button in half with
             it. The whole id is on the row that opened this, and in the
             playtest bar underneath. */
          title={`${STAGE04} · ${open}`.slice(0, 24)}
          onClear={back}
          onExit={back}
          onFail={back}
        />
      );
    }
    return (
      <EngineStage
        key={open}
        scene={scene!}
        bugId={open}
        playtest
        title={`${sceneId} · ${open}`.slice(0, 24)}
        onClear={back}
        onExit={back}
        onFail={back}
      />
    );
  }

  const tabs = [...ENGINE_SCENES.map((s) => s.id), STAGE04];

  return (
    <div className="wb-root dbg-root">
      <div className="wb-header">
        <button className="exit-btn" onClick={onExit} title="나가기">
          ←
        </button>
        <span className="wb-build">디버그</span>
        <span className="wb-deadline">{shown.length}개</span>
      </div>

      <div className="dbg-tabs">
        {tabs.map((id) => (
          <button
            key={id}
            className={id === sceneId ? "on" : ""}
            onClick={() => {
              setSceneId(id);
              setFilter("");
            }}
          >
            {id.replace("stage", "")}
          </button>
        ))}
      </div>

      <input
        className="dbg-filter"
        value={filter}
        placeholder="대상, 종류, 설명으로 거르기"
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="dbg-list">
        {/* the id is the mutator and the target joined, so printing it as well
            as both of them is the same three words twice — it stays as the
            row's title, which is what gets pasted into a bug report */}
        {shown.map((r) => (
          <button
            key={r.bugId}
            className="dbg-row"
            title={r.bugId}
            onClick={() => setOpen(r.bugId)}
          >
            <span className="dbg-mut">
              {r.mutator}
              {r.subtlety ? <i> ·{r.subtlety}</i> : null}
            </span>
            <span className="dbg-cat">{r.category}</span>
            <span className="dbg-target">{r.target}</span>
            <span className="dbg-desc">{r.desc}</span>
          </button>
        ))}
        {!shown.length && <p className="dbg-empty">없다</p>}
      </div>
    </div>
  );
}
