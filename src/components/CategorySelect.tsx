import { ALL_CATEGORIES, type BugCategory } from "../core/types";
import { useI18n } from "../i18n";
import { useState } from "react";

interface Props {
  targetObjectId: string;
  /** pre-resolved label; falls back to the legacy `object.<id>` key */
  targetLabel?: string;
  onSubmit: (category: BugCategory) => void;
  onCancel: () => void;
}

export function CategorySelect({
  targetObjectId,
  targetLabel,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<BugCategory | null>(null);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{t("category.title")}</h2>
        <p className="modal-target">
          🔍 {targetLabel ?? t(`object.${targetObjectId}`)}
        </p>
        <div className="category-list">
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`category-item ${selected === c ? "selected" : ""}`}
              onClick={() => setSelected(c)}
            >
              <span className="category-label">{t(`category.${c}`)}</span>
              <span className="category-desc">{t(`category.${c}.desc`)}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>
            {t("challenge.cancel")}
          </button>
          <button
            className="btn-primary"
            disabled={!selected}
            onClick={() => selected && onSubmit(selected)}
          >
            {t("category.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
