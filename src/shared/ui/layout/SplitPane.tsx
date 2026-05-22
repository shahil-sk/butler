import { type ReactNode, useCallback, useRef, useState } from "react";
import { cn } from "@/shared/utils";

/** Resizable two-pane layout. Drag the divider to resize. */
export function SplitPane({
  left,
  right,
  defaultLeftWidth = 260,
  minLeft = 160,
  maxLeft = 520,
  className,
}: {
  left: ReactNode;
  right: ReactNode;
  defaultLeftWidth?: number;
  minLeft?: number;
  maxLeft?: number;
  className?: string;
}) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(defaultLeftWidth);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current   = e.clientX;
    startW.current   = leftWidth;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      setLeftWidth(Math.min(maxLeft, Math.max(minLeft, startW.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [leftWidth, minLeft, maxLeft]);

  return (
    <div className={cn("flex h-full overflow-hidden", className)}>
      <div style={{ width: leftWidth, minWidth: leftWidth }} className="shrink-0 overflow-hidden">
        {left}
      </div>
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-px bg-border hover:bg-primary/40 cursor-col-resize shrink-0 transition-colors"
      />
      <div className="flex-1 min-w-0 overflow-hidden">{right}</div>
    </div>
  );
}
