import type { BugDef } from "../core/types";
import { useI18n } from "../i18n";

interface Props {
  success: boolean;
  /** legacy hand-authored bug (stages 1-6) */
  bug?: BugDef | null;
  /** engine-generated description, already translated */
  bugText?: string | null;
  onRetry: () => void;
  onDone: () => void;
}

export function ResultModal({ success, bug, bugText, onRetry, onDone }: Props) {
  const { t } = useI18n();
  const desc = bugText ?? (bug ? t(bug.descKey) : null);

  return (
    <div className="modal-backdrop">
      <div className={`modal result ${success ? "success" : "fail"}`}>
        <div className="result-emoji">{success ? "🎉" : "❌"}</div>
        <h2>{success ? t("result.success.title") : t("result.fail.title")}</h2>
        <p>{success ? t("result.success.body") : t("result.fail.body")}</p>
        {success && desc && <p className="bug-desc">🐛 {desc}</p>}
        <div className="modal-actions">
          {success ? (
            <button data-space className="btn-primary" onClick={onDone}>
              {t("result.next")}
            </button>
          ) : (
            <button data-space className="btn-primary" onClick={onRetry}>
              {t("result.retry")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
