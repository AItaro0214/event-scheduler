import { useEffect, useState } from "preact/hooks";

/** Payloads carried by a drag. */
export type DragPayload =
  | { kind: "person"; personId: string }
  | {
      kind: "assignment";
      personId: string;
      pageId: string;
      rowId: string;
      colId: string;
      assignmentId: string;
    }
  | { kind: "reorder"; list: "people" | "slots" | "marks"; id: string };

export interface DropTarget {
  el: HTMLElement;
  type: string;
  data: DOMStringMap;
}

export interface Point {
  x: number;
  y: number;
}

interface DragOptions {
  payload: DragPayload;
  /** Element cloned to build the floating ghost (keeps the grab point under the finger). */
  ghostFrom?: HTMLElement;
  /** Prebuilt detached element used as the ghost; floats just above the finger. */
  ghost?: HTMLElement;
  /** Movement in px before a drag starts (default 6). */
  threshold?: number;
  /** When "x", the first movement must be mostly horizontal to start (lets vertical pans scroll). */
  axis?: "x" | "any";
  /** Scroll container to auto-scroll near its edges. */
  scrollEl?: HTMLElement | null;
  onMove?: (target: DropTarget | null, p: Point) => void;
  onDrop: (target: DropTarget | null, p: Point) => void;
  onEnd?: () => void;
}

let activeKind: DragPayload["kind"] | null = null;
let activeList: string | null = null;
const listeners = new Set<() => void>();
function setActive(kind: DragPayload["kind"] | null, list: string | null) {
  activeKind = kind;
  activeList = list;
  for (const l of listeners) l();
}

/** Current drag kind (null when idle) — lets the UI show the trash zone etc. */
export function useDragKind(): { kind: DragPayload["kind"] | null; list: string | null } {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { kind: activeKind, list: activeList };
}

let suppressClickUntil = 0;
/** True right after a drag finished, so click handlers can ignore the synthetic click. */
export function wasJustDragging(): boolean {
  return performance.now() < suppressClickUntil;
}

function acceptsPayload(el: HTMLElement, payload: DragPayload): boolean {
  const accept = el.dataset.accept;
  if (!accept) return true;
  const kinds = accept.split(/\s+/);
  if (payload.kind === "reorder") return kinds.includes(`reorder:${payload.list}`);
  return kinds.includes(payload.kind);
}

function findTarget(p: Point, payload: DragPayload): DropTarget | null {
  const el = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
  if (!el) return null;
  let node: HTMLElement | null = el.closest<HTMLElement>("[data-drop]");
  while (node) {
    if (acceptsPayload(node, payload)) return { el: node, type: node.dataset.drop!, data: node.dataset };
    node = node.parentElement?.closest<HTMLElement>("[data-drop]") ?? null;
  }
  return null;
}

/**
 * Arm a drag on pointerdown. The drag begins once the pointer travels past the
 * threshold; until then nothing happens, so taps still work.
 */
export function armDrag(e: PointerEvent, opts: DragOptions): void {
  if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
  const start: Point = { x: e.clientX, y: e.clientY };
  const threshold = opts.threshold ?? 6;
  const pointerId = e.pointerId;
  let started = false;
  let ghost: HTMLElement | null = null;
  let offset: Point = { x: 0, y: 0 };
  let over: DropTarget | null = null;
  let last: Point = start;
  let raf = 0;
  let autoScrollTimer = 0;

  const cleanup = () => {
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onCancel, true);
    window.removeEventListener("keydown", onKey, true);
    if (autoScrollTimer) cancelAnimationFrame(autoScrollTimer);
    if (raf) cancelAnimationFrame(raf);
    if (started) {
      ghost?.remove();
      over?.el.classList.remove("drop-over");
      document.body.classList.remove("is-dragging");
      document.body.removeAttribute("data-drag-kind");
      setActive(null, null);
      suppressClickUntil = performance.now() + 400;
      opts.onEnd?.();
    }
  };

  const begin = () => {
    started = true;
    if (opts.ghostFrom) {
      const src = opts.ghostFrom;
      const rect = src.getBoundingClientRect();
      ghost = src.cloneNode(true) as HTMLElement;
      ghost.classList.add("drag-ghost");
      ghost.removeAttribute("id");
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      // Keep the grab point under the finger, but never let the ghost hide it.
      offset = {
        x: Math.min(start.x - rect.left, rect.width - 8),
        y: Math.min(start.y - rect.top, rect.height - 8),
      };
      document.body.appendChild(ghost);
    } else {
      ghost = opts.ghost ?? document.createElement("div");
      ghost.classList.add("drag-ghost");
      document.body.appendChild(ghost);
      const rect = ghost.getBoundingClientRect();
      offset = { x: rect.width / 2, y: rect.height + (e.pointerType === "mouse" ? -rect.height / 2 : 14) };
    }
    placeGhost();
    document.body.classList.add("is-dragging");
    document.body.setAttribute("data-drag-kind", opts.payload.kind);
    setActive(opts.payload.kind, opts.payload.kind === "reorder" ? opts.payload.list : null);
    try {
      (e.target as HTMLElement).setPointerCapture?.(pointerId);
    } catch {
      /* capture is best-effort */
    }
    if (opts.scrollEl) autoScroll();
  };

  const placeGhost = () => {
    raf = 0;
    if (!ghost) return;
    ghost.style.transform = `translate(${last.x - offset.x}px, ${last.y - offset.y}px)`;
  };

  const updateTarget = () => {
    const t = findTarget(last, opts.payload);
    if (t?.el !== over?.el) {
      over?.el.classList.remove("drop-over");
      t?.el.classList.add("drop-over");
      over = t;
    }
    opts.onMove?.(over, last);
  };

  const autoScroll = () => {
    const el = opts.scrollEl!;
    const r = el.getBoundingClientRect();
    const edge = 48;
    let dx = 0;
    let dy = 0;
    if (last.y < r.top + edge) dy = -((r.top + edge - last.y) / edge) * 14;
    else if (last.y > r.bottom - edge) dy = ((last.y - (r.bottom - edge)) / edge) * 14;
    if (last.x < r.left + edge) dx = -((r.left + edge - last.x) / edge) * 14;
    else if (last.x > r.right - edge) dx = ((last.x - (r.right - edge)) / edge) * 14;
    if (dx || dy) {
      el.scrollBy(dx, dy);
      updateTarget();
    }
    autoScrollTimer = requestAnimationFrame(autoScroll);
  };

  function onMove(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;
    last = { x: ev.clientX, y: ev.clientY };
    if (!started) {
      const dx = last.x - start.x;
      const dy = last.y - start.y;
      const dist = Math.hypot(dx, dy);
      if (dist < threshold) return;
      if (opts.axis === "x" && ev.pointerType !== "mouse" && Math.abs(dy) > Math.abs(dx) * 1.2) {
        // Vertical intent: let the browser scroll instead.
        cleanup();
        return;
      }
      begin();
    }
    ev.preventDefault();
    if (!raf) raf = requestAnimationFrame(placeGhost);
    updateTarget();
  }

  function onUp(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;
    if (started) {
      // Some touch stacks report (0,0) on the final up; fall back to the last move.
      if (ev.clientX || ev.clientY) last = { x: ev.clientX, y: ev.clientY };
      const t = findTarget(last, opts.payload);
      cleanup();
      opts.onDrop(t, last);
    } else {
      cleanup();
    }
  }

  function onCancel(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;
    cleanup();
  }

  function onKey(ev: KeyboardEvent) {
    if (ev.key === "Escape") cleanup();
  }

  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", onCancel, true);
  window.addEventListener("keydown", onKey, true);
}
