import { useEffect, useRef, useState, type ReactNode } from "react";

export const FIELD_W = 360;
export const FIELD_H = 640;

/**
 * Scales the fixed 360x640 (9:16) logical field to fit its container.
 *
 * It fits BOTH axes. Fitting width alone made the field taller than the space
 * left under the header, which is what put a scrollbar on the page whenever
 * the chrome grew — the playtest bar wrapping to two lines was enough.
 */
export function FieldScaler({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / FIELD_W, r.height / FIELD_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={outerRef} className="field-outer">
      <div
        className="field-clip"
        style={{ width: FIELD_W * scale, height: FIELD_H * scale }}
      >
        <div
          style={{
            width: FIELD_W,
            height: FIELD_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
