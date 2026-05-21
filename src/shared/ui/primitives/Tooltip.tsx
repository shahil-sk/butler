import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils";

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const GAP = 6;
    const positions = {
      top:    { top: r.top - GAP,    left: r.left + r.width / 2 },
      bottom: { top: r.bottom + GAP, left: r.left + r.width / 2 },
      left:   { top: r.top + r.height / 2, left: r.left - GAP },
      right:  { top: r.top + r.height / 2, left: r.right + GAP },
    };
    setPos(positions[side]);
    setVisible(true);
  };

  return (
    <>
      <span
        ref={ref}
        className="inline-flex"
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={() => setVisible(false)}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            className={cn(
              "fixed z-[99999] px-2 py-1 rounded-md text-[11px] font-medium",
              "bg-foreground text-background shadow-md pointer-events-none",
              "whitespace-nowrap",
              side === "top" && "-translate-x-1/2 -translate-y-full",
              side === "bottom" && "-translate-x-1/2",
              side === "left" && "-translate-x-full -translate-y-1/2",
              side === "right" && "-translate-y-1/2"
            )}
            style={pos}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
