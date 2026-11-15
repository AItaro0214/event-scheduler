import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

export type Anchor = { x: number; y: number; w?: number; h?: number };

export function anchorFromEl(el: Element | null): Anchor {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

interface PopoverProps {
  anchor: Anchor;
  onClose: () => void;
  children: ComponentChildren;
  /** Force bottom-sheet presentation regardless of viewport (default: auto below 640px). */
  sheet?: boolean;
  dim?: boolean;
  width?: number;
}

/** Anchored popover that clamps to the viewport; becomes a bottom sheet on narrow screens. */
export function Popover({ anchor, onClose, children, sheet, dim, width }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);
  const asSheet = sheet ?? window.innerWidth < 640;

  useLayoutEffect(() => {
    if (asSheet) return;
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 12;
      const aw = anchor.w ?? 0;
      const ah = anchor.h ?? 0;
      let left = anchor.x + aw / 2 - r.width / 2;
      left = Math.max(margin, Math.min(vw - r.width - margin, left));
      let top = anchor.y + ah + 8;
      let origin = "top center";
      if (top + r.height > vh - margin) {
        const above = anchor.y - 8 - r.height;
        if (above >= margin) {
          top = above;
          origin = "bottom center";
        } else {
          top = Math.max(margin, vh - r.height - margin);
          origin = "center";
        }
      }
      setPos({ left, top, origin });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor.x, anchor.y, anchor.w, anchor.h, asSheet]);

  return (
    <>
      <div
        class={`scrim${dim || asSheet ? " dim" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={ref}
        class={`popover${asSheet ? " sheet" : ""}`}
        role="dialog"
        style={
          asSheet
            ? undefined
            : {
                left: pos?.left ?? -9999,
                top: pos?.top ?? -9999,
                width: width ? `${width}px` : undefined,
                "--origin": pos?.origin ?? "top center",
                visibility: pos ? "visible" : "hidden",
              }
        }
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {children}
      </div>
    </>
  );
}

interface DialogProps {
  title?: string;
  message?: string;
  children?: ComponentChildren;
  actions: ComponentChildren;
  onClose: () => void;
}

export function Dialog({ title, message, children, actions, onClose }: DialogProps) {
  return (
    <>
      <div class="scrim dim" onPointerDown={onClose} />
      <div class="dialog" role="alertdialog" aria-modal="true">
        {title && <h2 class="dialog-title">{title}</h2>}
        {message && <p class="dialog-msg">{message}</p>}
        {children}
        <div class="dialog-actions">{actions}</div>
      </div>
    </>
  );
}
