import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { COPY, fmt } from "../copy";
import type { MarkDef } from "../types";
import { Chip } from "./Chip";
import { IconDownload, IconFile, IconNote, IconPause, IconPlay } from "./icons";

/*
 * Self-playing miniature of the app, driven by one clock. Every element's
 * state is a pure function of time `t` (ms), so pause / jump / static frames
 * fall out for free and nothing here touches the real sheet.
 */

export const W = 560;
export const H = 315;

// ---- timeline (ms) ----
const S = [0, 4600, 7400, 15000] as const; // scene starts
const END = 19200;
const SCENE_FRAMES = [3600, 6900, 10300, 17600]; // representative stills (reduced motion)

// ---- easing / keyframe helpers ----
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => 1 + 2.3 * Math.pow(x - 1, 3) + 1.3 * Math.pow(x - 1, 2);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
/** Progress 0..1 of t inside [a, b] with easing. */
const prog = (t: number, a: number, b: number, ease = easeOut) => ease(clamp01((t - a) / (b - a)));

type KF<T> = [number, T];
function track(t: number, kfs: KF<number[]>[], ease = easeInOut): number[] {
  if (t <= kfs[0][0]) return kfs[0][1];
  for (let i = 1; i < kfs.length; i++) {
    const [t1, v1] = kfs[i];
    if (t <= t1) {
      const [t0, v0] = kfs[i - 1];
      const k = ease(clamp01((t - t0) / (t1 - t0)));
      return v0.map((v, j) => mix(v, v1[j], k));
    }
  }
  return kfs[kfs.length - 1][1];
}
/** Quadratic bezier between p0 and p2 via p1. */
const bez = (p0: number[], p1: number[], p2: number[], k: number) => [
  (1 - k) * (1 - k) * p0[0] + 2 * (1 - k) * k * p1[0] + k * k * p2[0],
  (1 - k) * (1 - k) * p0[1] + 2 * (1 - k) * k * p1[1] + k * k * p2[1],
];

// ---- world geometry (560×315 miniature of the app) ----
const CELL_C = [127, 113];
const LIST_Y = (i: number) => 138 + i * 32;
const PERSON = (i: number) => [470, LIST_Y(i) + 13];
const ADD_BTN = [480, 117];
const POP = { x: 150, y: 118, w: 150, h: 114 };
const SLOT_BTN = [173, 148];
const MARK_RE = [171, 174];
const MARK_KA = [201, 174];
const PLACE_BTN = [275, 218];
const PDF_BTN = [517, 15];
const NAMES = ["田中", "桐谷", "森"];

const CAMERA: KF<number[]>[] = [
  [0, [470, 130, 1.6]],
  [4600, [470, 130, 1.6]],
  [5400, [330, 170, 1.25]],
  [7400, [330, 170, 1.25]],
  [8100, [215, 165, 1.55]],
  [10950, [215, 165, 1.55]],
  [11600, [330, 170, 1.25]],
  [12700, [330, 170, 1.25]],
  [13200, [215, 165, 1.55]],
  [15000, [215, 165, 1.55]],
  [15800, [470, 60, 1.7]],
  [16000, [470, 60, 1.7]],
  [16800, [400, 90, 1.5]],
  [END, [400, 90, 1.5]],
];

const FINGER: KF<number[]>[] = [
  [1500, [600, 320]],
  [1950, ADD_BTN],
  [2400, ADD_BTN],
  [3000, [466, 172]],
  [4700, [466, 172]],
  [5300, PERSON(0)],
  [5500, PERSON(0)],
  [7000, CELL_C],
  [7300, CELL_C],
  [7700, [140, 250]],
  [8600, SLOT_BTN],
  [8900, SLOT_BTN],
  [9350, MARK_RE],
  [9550, MARK_RE],
  [10000, MARK_KA],
  [10250, MARK_KA],
  [10750, PLACE_BTN],
  [11000, PLACE_BTN],
  [11550, PERSON(1)],
  [11700, PERSON(1)],
  [12500, CELL_C],
  [12550, CELL_C],
  [13000, [140, 250]],
  [13650, SLOT_BTN],
  [13850, SLOT_BTN],
  [14200, PLACE_BTN],
  [14400, PLACE_BTN],
  [15000, [300, 260]],
  [15800, PDF_BTN],
  [16100, PDF_BTN],
  [16700, [560, 300]],
  [END, [560, 300]],
];
const PRESSES: [number, number][] = [
  [1950, 2200], [5300, 7100], [8650, 8850], [9350, 9550], [10000, 10200], [10750, 10950],
  [11550, 12550], [13650, 13850], [14200, 14400], [15800, 16000],
];
const DRAGS: [number, number, number][] = [
  [5500, 7000, 0], // start, end, person index
  [11700, 12500, 1],
];

const RE: MarkDef = { id: "re", label: "レ", color: "#d7263d" };
const KA: MarkDef = { id: "ka", label: "カ", color: "#1f3b8f" };

function fingerPos(t: number): number[] {
  // Drag segments follow a curve so the hand reads as a real reach.
  for (const [a, b, i] of DRAGS) {
    if (t >= a && t <= b) return bez(PERSON(i), [330, 70], CELL_C, easeInOut(clamp01((t - a) / (b - a))));
  }
  return track(t, FINGER, easeInOut);
}

interface Frame {
  cam: number[]; // fx, fy, scale
  finger: { x: number; y: number; down: number; show: boolean };
  typed: string;
  caret: boolean;
  listPop: number[]; // 0..1 per name
  ghost: { x: number; y: number; name: string } | null;
  cellHot: boolean;
  popover: { k: number; name: string; slot: boolean; re: boolean; ka: boolean } | null;
  chips: { name: string; marks: MarkDef[]; pop: number }[];
  pdfPressed: boolean;
  files: { pdf: number[] | null; json: number[] | null }; // x, y, rot, k
  fade: number;
  scene: number;
}

function frameAt(t: number): Frame {
  const cam = track(t, CAMERA, easeInOut);
  const [fx, fy] = fingerPos(t);
  const down = PRESSES.reduce((d, [a, b]) => Math.max(d, t >= a && t <= b ? 1 - prog(t, b - 90, b) * 0 : 0), 0);
  const fullText = `${NAMES[0]}\n${NAMES[1]}\n${NAMES[2]}`;
  const typedN = t < 2150 ? Math.floor(clamp01((t - 500) / 800) * fullText.length) : 0;
  const listPop = NAMES.map((_, i) => prog(t, 2200 + i * 140, 2520 + i * 140, easeOutBack));
  let ghost: Frame["ghost"] = null;
  for (const [a, b, i] of DRAGS) if (t >= a - 150 && t <= b + 100) ghost = { x: fx, y: fy, name: NAMES[i] };
  const cellHot = (t >= 6750 && t < 7400) || (t >= 12300 && t < 12700);
  let popover: Frame["popover"] = null;
  if (t >= 7400 && t < 10900) {
    popover = { k: prog(t, 7400, 7620, easeOutBack), name: NAMES[0], slot: t >= 8650, re: t >= 9350, ka: t >= 10000 };
  } else if (t >= 12700 && t < 14350) {
    popover = { k: prog(t, 12700, 12920, easeOutBack), name: NAMES[1], slot: t >= 13650, re: false, ka: false };
  }
  const chips: Frame["chips"] = [];
  if (t >= 10950) chips.push({ name: NAMES[0], marks: [RE, KA], pop: prog(t, 10950, 11350, easeOutBack) });
  if (t >= 14400) chips.push({ name: NAMES[1], marks: [], pop: prog(t, 14400, 14800, easeOutBack) });
  const fly = (a: number, to: number[], rot: number) => {
    if (t < a) return null;
    const k = prog(t, a, a + 900, easeInOut);
    const p = bez(PDF_BTN, [to[0] + 60, -10], to, k);
    return [p[0], p[1], rot * k, k];
  };
  const files = { pdf: fly(15950, [318, 112], -7), json: fly(16250, [372, 120], 6) };
  const fade = t > END - 600 ? prog(t, END - 600, END, easeInOut) : t < 400 ? 1 - prog(t, 0, 400, easeInOut) : 0;
  const scene = S.filter((s) => t >= s).length - 1;
  return {
    cam,
    finger: { x: fx, y: fy, down, show: t >= 1500 },
    typed: fullText.slice(0, typedN),
    caret: t >= 450 && t < 2150 && Math.floor(t / 420) % 2 === 0,
    listPop,
    ghost,
    cellHot,
    popover,
    chips,
    pdfPressed: t >= 15800 && t < 16050,
    files,
    fade,
    scene,
  };
}

function useReducedMotion() {
  const [rm, setRm] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setRm(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return rm;
}

export function Demo() {
  const reduced = useReducedMotion();
  const [t, setT] = useState(reduced ? SCENE_FRAMES[0] : 0);
  const [playing, setPlaying] = useState(!reduced);
  const [width, setWidth] = useState(W);
  const hostRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(t);
  tRef.current = t;

  // Clock: rAF while playing and the tab is visible.
  useEffect(() => {
    if (!playing || reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      setT((prev) => (prev + dt) % END);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [playing, reduced]);

  // Fit the fixed-size stage to the dialog width.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const f = useMemo(() => frameAt(t), [t]);
  const fit = width / W;
  const [fx0, fy0, cs] = f.cam;
  // Keep the viewport inside the world so no empty edge ever shows.
  const tx = Math.max(W - W * cs, Math.min(0, W / 2 - fx0 * cs));
  const ty = Math.max(H - H * cs, Math.min(0, H / 2 - fy0 * cs));
  const cx = (W / 2 - tx) / cs;
  const cy = (H / 2 - ty) / cs;
  const camStyle = `translate(${tx}px, ${ty}px) scale(${cs})`;
  const jump = (i: number) => {
    setT(reduced ? SCENE_FRAMES[i] : S[i] + 1);
  };
  const scene = reduced ? SCENE_FRAMES.indexOf(t) : f.scene;
  const sceneEnd = scene < 3 ? S[scene + 1] : END;
  const sceneProgress = reduced ? 1 : clamp01((t - S[scene]) / (sceneEnd - S[scene]));
  const title = COPY[`demoScene${scene + 1}` as keyof typeof COPY];
  const body = COPY[`demoScene${scene + 1}Body` as keyof typeof COPY];

  return (
    <div class="demo" data-scene={scene + 1}>
      <div class="demo-host" ref={hostRef} style={{ height: `${H * fit}px` }}>
        <div class="demo-stage" style={{ transform: `scale(${fit})` }} aria-hidden>
          <div class="demo-world" style={{ transform: camStyle }}>
            <MiniApp f={f} />
          </div>
          {f.finger.show && !reduced && (
            <Finger x={(f.finger.x - cx) * cs + W / 2} y={(f.finger.y - cy) * cs + H / 2} down={f.finger.down > 0} />
          )}
          {f.ghost && (
            <div
              class="demo-ghost person-pill"
              style={{
                left: `${(f.ghost.x - cx) * cs + W / 2}px`,
                top: `${(f.ghost.y - cy) * cs + H / 2}px`,
              }}
            >
              {f.ghost.name}
            </div>
          )}
          <div class="demo-fade" style={{ opacity: f.fade }} />
        </div>
      </div>
      <div class="demo-caption">
        <div class="demo-text">
          <b>{title}</b>
          <span>{body}</span>
        </div>
        <div class="demo-controls">
          <div class="demo-dots" role="tablist">
            {[0, 1, 2, 3].map((i) => (
              <button
                type="button"
                key={i}
                role="tab"
                aria-selected={scene === i}
                aria-label={COPY[`demoScene${i + 1}` as keyof typeof COPY]}
                class={`demo-dot${scene === i ? " on" : ""}`}
                onClick={() => jump(i)}
              >
                {scene === i && <i style={{ transform: `scaleX(${sceneProgress})` }} />}
              </button>
            ))}
          </div>
          {!reduced && (
            <button
              type="button"
              class="btn btn-icon btn-ghost demo-play"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? COPY.demoPause : COPY.demoPlay}
              title={playing ? COPY.demoPause : COPY.demoPlay}
            >
              {playing ? <IconPause /> : <IconPlay />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Finger({ x, y, down }: { x: number; y: number; down: boolean }) {
  return (
    <div class={`demo-finger${down ? " down" : ""}`} style={{ left: `${x}px`, top: `${y}px` }}>
      <span class="demo-ripple" />
    </div>
  );
}

/** The miniature app: top bar, sheet with one highlighted cell, member panel, popover, files. */
function MiniApp({ f }: { f: Frame }) {
  const cols = ["日付", "店頭", "ブース", "メモ"];
  const widths = [50, 95, 110, 55];
  return (
    <div class="mini">
      <div class="mini-top">
        <span class="mini-brand">
          <i />
          {COPY.appName}
        </span>
        <span class="mini-spacer" />
        <span class="mini-btn outline">
          <IconNote />
          {COPY.addNote}
        </span>
        <span class="mini-btn">{COPY.saveJson}</span>
        <span class={`mini-btn primary${f.pdfPressed ? " pressed" : ""}`}>
          <IconDownload />
          {COPY.savePdf}
        </span>
      </div>
      <div class="mini-stage">
        <div class="mini-page">
          <div class="mini-headnote">A 13:00〜18:30</div>
          <div class="mini-table" style={{ "--cols": widths.map((w) => `${w}px`).join(" ") }}>
            <div class="mini-title">例）お客様感謝祭</div>
            <div class="mini-row head">
              {cols.map((c) => (
                <div key={c}>{c}</div>
              ))}
            </div>
            {[0, 1, 2, 3, 4].map((r) => (
              <div class="mini-row" key={r}>
                <div class="mini-date">{r === 0 ? "11月3日(火)" : ""}</div>
                <div class={`mini-cell${r === 0 && f.cellHot ? " hot" : ""}`}>
                  {r === 0 && f.chips.length > 0 && (
                    <div class="slot-line">
                      <span class="slot-label">早:</span>
                      {f.chips.map((c, i) => (
                        <span key={c.name} style={{ display: "inline-flex", transform: `scale(${0.7 + 0.3 * c.pop})`, transformOrigin: "left bottom" }}>
                          {i > 0 && <span class="sep">・</span>}
                          <Chip name={c.name} marks={c.marks} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div class="mini-cell" />
                <div class="mini-cell" />
              </div>
            ))}
          </div>
        </div>
        {f.popover && (
          <div
            class="mini-pop"
            style={{
              left: `${POP.x}px`,
              top: `${POP.y}px`,
              width: `${POP.w}px`,
              transform: `scale(${0.9 + 0.1 * f.popover.k})`,
              opacity: f.popover.k,
            }}
          >
            <div class="mini-pop-title">{fmt(COPY.popoverTitle, { name: f.popover.name })}</div>
            <div class="mini-pop-label">{COPY.popoverSlot}</div>
            <div class="mini-choices">
              {["早", "10中", "中", "遅"].map((s, i) => (
                <span key={s} class={`mini-choice${i === 0 && f.popover!.slot ? " on" : ""}`}>
                  {s}
                </span>
              ))}
            </div>
            <div class="mini-pop-label">{COPY.popoverMarks}</div>
            <div class="mini-marks">
              <span class={`mini-mark${f.popover.re ? " on" : ""}`} style={{ "--c": RE.color }}>
                <i class="badge circ" style={{ "--c": RE.color }}>レ</i>レ
              </span>
              <span class={`mini-mark${f.popover.ka ? " on" : ""}`} style={{ "--c": KA.color }}>
                <i class="badge circ" style={{ "--c": KA.color }}>カ</i>カ
              </span>
              <span class="mini-mark" style={{ "--c": "#1f3b8f" }}>
                <b style={{ color: "#1f3b8f" }}>お迎え</b>
              </span>
              <span class="mini-mark" style={{ "--c": "#d7263d" }}>
                <b style={{ color: "#d7263d" }}>メイク</b>
              </span>
            </div>
            <div class="mini-pop-actions">
              <span class="mini-btn">{COPY.cancel}</span>
              <span class="mini-btn primary">{COPY.place}</span>
            </div>
          </div>
        )}
        {f.files.pdf && <FileCard kind="pdf" p={f.files.pdf} />}
        {f.files.json && <FileCard kind="json" p={f.files.json} />}
      </div>
      <div class="mini-panel">
        <div class="mini-tabs">
          <span class="on">{COPY.people}</span>
          <span>{COPY.slots}</span>
          <span>{COPY.marks}</span>
        </div>
        <div class={`mini-field${f.typed ? "" : " ph"}`}>
          {(f.typed || COPY.personPlaceholder).split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {f.caret && i === arr.length - 1 && <em class="mini-caret" />}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </div>
        <div class={`mini-btn primary block${f.finger.down > 0 && f.finger.x === ADD_BTN[0] && f.finger.y === ADD_BTN[1] ? " pressed" : ""}`}>
          ＋ {COPY.addPerson}
        </div>
        {NAMES.map((n, i) =>
          f.listPop[i] > 0 ? (
            <div
              key={n}
              class="mini-item"
              style={{ top: `${LIST_Y(i) - 30}px`, transform: `scale(${f.listPop[i]})`, opacity: Math.min(1, f.listPop[i] * 1.4) }}
            >
              <span class="grip">⋮⋮</span>
              <span class="mini-name">{n}</span>
              <span class="mini-count">{fmt(COPY.placedCount, { n: f.chips.some((c) => c.name === n) ? 1 : 0 })}</span>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

function FileCard({ kind, p }: { kind: "pdf" | "json"; p: number[] }) {
  const [x, y, rot, k] = p;
  return (
    <div
      class={`mini-file ${kind}`}
      style={{ left: `${x}px`, top: `${y}px`, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${0.4 + 0.6 * k})`, opacity: Math.min(1, k * 3) }}
    >
      <IconFile />
      <span class="mini-file-label">{kind === "pdf" ? "PDF" : COPY.saveDataName}</span>
    </div>
  );
}
