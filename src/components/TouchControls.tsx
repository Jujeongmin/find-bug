import { useEffect, useRef } from "react";
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
  /*
   * Which finger is holding which key.
   *
   * The button's own onPointerUp is not enough by itself. This row is unmounted
   * whenever play stops — pressing "report a defect" mid-stride does it — and a
   * key still held at that moment stays in the shared set with nothing left to
   * take it out, so the character walks off on their own the next time the
   * field is drawn and every later press is fighting a key that is never
   * released. Kept per pointer because the jump button sits right beside these:
   * a second finger lifting must not let go of the first one's key.
   */
  const held = useRef(new Map<number, string>());

  useEffect(() => {
    const map = held.current;
    const set = keys.current;
    const end = (e: PointerEvent) => {
      const k = map.get(e.pointerId);
      if (k === undefined) return;
      map.delete(e.pointerId);
      set.delete(k);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      for (const k of map.values()) set.delete(k);
      map.clear();
    };
  }, [keys]);

  const btn = (label: string, extraClass = "") => {
    const key = HOLD_KEYS[label];
    const press = (e: React.PointerEvent) => {
      held.current.set(e.pointerId, key);
      keys.current.add(key);
    };
    const release = (e: React.PointerEvent) => {
      held.current.delete(e.pointerId);
      keys.current.delete(key);
    };
    return (
      <button
        key={label}
        className={`tc-btn ${extraClass}`}
        onPointerDown={(e) => {
          e.preventDefault();
          press(e);
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
