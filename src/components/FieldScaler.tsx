import { useEffect, useRef, useState, type ReactNode } from "react";

export const FIELD_W = 360;
export const FIELD_H = 640;

/**
 * Scales the fixed 360x640 (9:16) logical field to fit the available
 * viewport space, preserving aspect ratio.
 */
export function FieldScaler({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScale(rect.width / FIELD_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="field-outer">
      <div className="field-clip" style={{ height: FIELD_H * scale }}>
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
