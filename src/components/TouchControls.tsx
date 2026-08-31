import type { MutableRefObject } from "react";

interface Props {
  /** shared pressed-keys set, same one the keyboard writes into */
  keys: MutableRefObject<Set<string>>;
  /** dpad = 4-way (stage 1), lr = left/right only (platformer) */
  mode: "dpad" | "lr";
}

const HOLD_KEYS: Record<string, string> = {
  "◀": "arrowleft",
  "▶": "arrowright",
  "▲": "arrowup",
  "▼": "arrowdown",
};

export function TouchControls({ keys, mode }: Props) {
  const btn = (label: string, extraClass = "") => {
    const key = HOLD_KEYS[label];
    const press = () => keys.current.add(key);
    const release = () => keys.current.delete(key);
    return (
      <button
        key={label}
        className={`tc-btn ${extraClass}`}
        onPointerDown={(e) => {
          e.preventDefault();
          press();
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        {label}
      </button>
    );
  };

  if (mode === "lr") {
    return (
      <div className="touch-controls lr">
        {btn("◀")}
        {btn("▶")}
      </div>
    );
  }

  return (
    <div className="touch-controls dpad">
      <div className="tc-row">{btn("▲")}</div>
      <div className="tc-row">
        {btn("◀")}
        {btn("▼")}
        {btn("▶")}
      </div>
    </div>
  );
}
