import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { COPY, fmt } from "../copy";
import type { MarkDef, Sheet } from "../types";
import { Chip } from "./Chip";

/** Coach-mark steps. `target` is a data-tour attribute value; `prepare` reveals it first. */
interface StepDef {
  target?: string;
  prepare?: () => void;
  illustration?: boolean;
}

const clickTab = (name: string) => () =>
  document.querySelector<HTMLElement>(`[data-tour="${name}"]`)?.click();

const STEPS: StepDef[] = [
  { target: "members-form", prepare: clickTab("tab-people") },
  { target: "cell" },
  { target: "tab-marks", prepare: clickTab("tab-marks"), illustration: true },
  { target: "tab-slots", prepare: clickTab("tab-slots") },
  { target: "date-cell" },
  { target: "col-header" },
  { target: "add-note" },
  { target: "add-page" },
  { target: "save-pdf" },
  { target: "save-json" },
  { target: "load-json" },
  {},
];
export const TOUR_STEPS = STEPS.length;

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 6;
const GAP = 14;
const MARGIN = 12;

interface Props {
  sheet: Sheet;
  step: number; // 0-based
  onStep: (n: number) => void;
  onClose: () => void;
}

export function Tour({ sheet, step, onStep, onClose: closeTour }: Props) {
  // Leave the side panel on メンバー whichever tab the tour visited last.
  const onClose = () => {
    clickTab("tab-people")();
    closeTour();
  };
  const def = STEPS[step];
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState({ w: 320, h: 200 });

  // Reveal the target, scroll it into view, then measure; re-measure on resize/scroll.
  useLayoutEffect(() => {
    setReady(false);
    def.prepare?.();
    let raf = 0;
    const measure = () => {
      const el = def.target ? document.querySelector<HTMLElement>(`[data-tour="${def.target}"]`) : null;
      if (!el) {
        setRect(null);
        setReady(true);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      setReady(true);
    };
    raf = requestAnimationFrame(() => {
      const el = def.target ? document.querySelector<HTMLElement>(`[data-tour="${def.target}"]`) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        const vis = r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
        if (!vis) el.scrollIntoView({ block: "center", inline: "center" });
      }
      raf = requestAnimationFrame(measure);
    });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w !== card.w || h !== card.h) setCard({ w, h });
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const last = step === STEPS.length - 1;
  const next = () => (last ? onClose() : onStep(step + 1));
  const back = () => step > 0 && onStep(step - 1);

  // ---- geometry ----
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spot: Rect = rect
    ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 }
    : { x: vw / 2, y: vh / 2, w: 0, h: 0 };

  let placement: "bottom" | "top" | "right" | "left" | "center" = "center";
  let cx = (vw - card.w) / 2;
  let cy = (vh - card.h) / 2;
  if (rect) {
    const below = vh - (spot.y + spot.h);
    const above = spot.y;
    const rightSp = vw - (spot.x + spot.w);
    const leftSp = spot.x;
    if (below >= card.h + GAP + MARGIN) placement = "bottom";
    else if (above >= card.h + GAP + MARGIN) placement = "top";
    else if (rightSp >= card.w + GAP + MARGIN) placement = "right";
    else if (leftSp >= card.w + GAP + MARGIN) placement = "left";
    const tcx = spot.x + spot.w / 2;
    const tcy = spot.y + spot.h / 2;
    if (placement === "bottom" || placement === "top") {
      cx = tcx - card.w / 2;
      cy = placement === "bottom" ? spot.y + spot.h + GAP : spot.y - GAP - card.h;
    } else if (placement === "right" || placement === "left") {
      cy = tcy - card.h / 2;
      cx = placement === "right" ? spot.x + spot.w + GAP : spot.x - GAP - card.w;
    }
    cx = Math.max(MARGIN, Math.min(vw - card.w - MARGIN, cx));
    cy = Math.max(MARGIN, Math.min(vh - card.h - MARGIN, cy));
  }
  // Arrow sits on the card edge facing the target, aligned with the target centre.
  let arrow: { left?: string; top?: string; right?: string; bottom?: string } | null = null;
  if (rect && placement !== "center") {
    const tcx = spot.x + spot.w / 2;
    const tcy = spot.y + spot.h / 2;
    const ax = Math.max(18, Math.min(card.w - 18, tcx - cx));
    const ay = Math.max(18, Math.min(card.h - 18, tcy - cy));
    if (placement === "bottom") arrow = { left: `${ax}px`, top: "-7px" };
    else if (placement === "top") arrow = { left: `${ax}px`, bottom: "-7px" };
    else if (placement === "right") arrow = { top: `${ay}px`, left: "-7px" };
    else arrow = { top: `${ay}px`, right: "-7px" };
  }

  const n = step + 1;
  const title = COPY[`tour${n}Title` as keyof typeof COPY];
  const body = COPY[`tour${n}Body` as keyof typeof COPY];

  return (
    <div class={`tour${ready ? " ready" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <div class="tour-blocker" onPointerDown={(e) => e.preventDefault()} />
      <div
        class={`tour-spot${rect ? "" : " none"}`}
        style={{ left: `${spot.x}px`, top: `${spot.y}px`, width: `${spot.w}px`, height: `${spot.h}px` }}
      />
      <div
        key={step}
        ref={cardRef}
        class={`tour-card ${placement}`}
        style={{ left: `${cx}px`, top: `${cy}px`, width: `${Math.min(320, vw - MARGIN * 2)}px` }}
      >
        {arrow && <span class="tour-arrow" style={arrow} />}
        <div class="tour-step">{fmt(COPY.tourStep, { n, total: STEPS.length })}</div>
        <h2 class="tour-title">{title}</h2>
        <p class="tour-body">{body}</p>
        {def.illustration && <Illustration marks={sheet.marks} />}
        <div class="tour-actions">
          <button type="button" class="btn btn-ghost btn-sm" onClick={onClose}>
            {COPY.tourSkip}
          </button>
          <span class="push" />
          <button type="button" class="btn btn-outline" onClick={back} disabled={step === 0} aria-label={COPY.tourBack}>
            {COPY.tourBack}
          </button>
          <button type="button" class="btn btn-primary" onClick={next}>
            {last ? COPY.tourDone : COPY.tourNext}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Static example of a name carrying two badges, drawn with the real Chip. */
function Illustration({ marks }: { marks: MarkDef[] }) {
  const pick = (label: string, color: string): MarkDef =>
    marks.find((m) => m.label === label) ?? { id: label, label, color };
  const sample = [pick("レ", "#d7263d"), pick("カ", "#1f3b8f")];
  return (
    <div class="tour-illus" aria-hidden>
      <span class="slot-label">早:</span>
      <Chip name="田中" marks={sample} />
      <span class="sep">・</span>
      <Chip name="桐谷" marks={[sample[0]]} />
    </div>
  );
}
