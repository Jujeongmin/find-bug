import { useState } from "react";
import { useI18n } from "../i18n";

export interface PlaytestInfo {
  sceneId: string;
  stageNo?: number;
  band?: number;
  score?: number;
  bugId: string;
  /** already-translated object names accepted as correct */
  answers: string;
  /** already-translated category label */
  category: string;
  /** already-translated description */
  desc: string;
  poolSize?: number;
}

interface Props {
  info: PlaytestInfo;
  onReroll?: () => void;
}

/**
 * Dev-only overlay shown when the page is opened with ?playtest=1.
 * Reveals the live answer so a playtester can check themselves without
 * spending their one report.
 */
export function PlaytestBar({ info, onReroll }: Props) {
  const [shown, setShown] = useState(false);
  const { t } = useI18n();
  void t;

  return (
    <div className="pt-bar">
      <span className="pt-tag">PLAYTEST</span>
      <span className="pt-meta">
        {info.sceneId}
        {info.stageNo ? ` · 스테이지 ${info.stageNo}` : ""}
        {info.band ? ` · 밴드 ${info.band}` : ""}
        {info.score !== undefined ? ` · 난이도 ${info.score.toFixed(2)}` : ""}
        {info.poolSize !== undefined ? ` · 풀 ${info.poolSize}` : ""}
      </span>
      {shown ? (
        <span className="pt-answer">
          <b>{info.answers}</b> / {info.category} — {info.desc}
          <code>{info.bugId}</code>
        </span>
      ) : (
        <button className="pt-btn" onClick={() => setShown(true)}>
          정답 보기
        </button>
      )}
      {onReroll && (
        <button
          className="pt-btn"
          onClick={() => {
            setShown(false);
            onReroll();
          }}
        >
          다른 버그로
        </button>
      )}
    </div>
  );
}
