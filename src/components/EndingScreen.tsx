import { useI18n } from "../i18n";

interface Props {
  /** how many builds were signed off */
  total: number;
  onBackToTitle: () => void;
}

/**
 * Shown once the final build is signed off. Closes the framing story: the
 * player's QA pass is what got the game out the door.
 */
export function EndingScreen({ total, onBackToTitle }: Props) {
  const { t, tp } = useI18n();

  return (
    <div className="ending">
      <p className="ending-eyebrow">{t("ending.eyebrow")}</p>
      <h1 className="ending-title">{t("ending.title")}</h1>
      <p className="ending-lead">{tp("ending.lead", { total: String(total) })}</p>

      <div className="ending-card">
        <div className="ending-stat">
          <b>{total}</b>
          <span>{t("ending.stat.builds")}</span>
        </div>
        <div className="ending-stat">
          <b>1</b>
          <span>{t("ending.stat.shipped")}</span>
        </div>
      </div>

      <p className="ending-note">{t("ending.note")}</p>

      <button className="btn-primary big" onClick={onBackToTitle}>
        {t("ending.back")}
      </button>
    </div>
  );
}
