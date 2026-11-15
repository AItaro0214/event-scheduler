import type { Cell, Column, MarkDef, Note, NoteColor, Page, Row, Sheet, SlotDef } from "./types";
import { PAGE_PAD, PAGE_W, TABLE_W } from "./types";

let counter = 0;
export function uid(prefix = "i"): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export const MARK_PALETTE = [
  "#d7263d", // red
  "#1f3b8f", // navy
  "#2a7de1", // blue
  "#1f8a4c", // green
  "#e07a1f", // orange
  "#7a3fb0", // purple
  "#0f8b8d", // teal
  "#6b7280", // gray
];

export const NOTE_COLORS: NoteColor[] = ["yellow", "pink", "green", "blue"];

export function defaultColumns(): Column[] {
  // Widths sum to TABLE_W.
  const names = ["日付", "店頭", "ブース", "メモ"];
  const widths = [138, 246, 313, TABLE_W - 138 - 246 - 313];
  return names.map((name, i) => ({ id: uid("c"), name, width: widths[i] }));
}

export function defaultSlots(): SlotDef[] {
  return ["早", "10中", "中", "遅"].map((name) => ({ id: uid("s"), name }));
}

export function defaultMarks(): MarkDef[] {
  const defs: [string, string][] = [
    ["お迎え", "#1f3b8f"],
    ["お見送り", "#1f3b8f"],
    ["メイク", "#d7263d"],
    ["レ", "#d7263d"],
    ["カ", "#1f3b8f"],
    ["午後", "#1f3b8f"],
  ];
  return defs.map(([label, color]) => ({ id: uid("m"), label, color }));
}

export function emptyCell(): Cell {
  return { text: "", assignments: [] };
}

export function makeRow(columns: Column[], label = ""): Row {
  const cells: Record<string, Cell> = {};
  for (const c of columns.slice(1)) cells[c.id] = emptyCell();
  return { id: uid("r"), label, cells };
}

export function makePage(columns: Column[], rowCount = 7, title = "", headerNote = ""): Page {
  return {
    id: uid("p"),
    title,
    headerNote,
    rows: Array.from({ length: rowCount }, () => makeRow(columns)),
    notes: [],
  };
}

export function newSheet(): Sheet {
  const columns = defaultColumns();
  return {
    columns,
    slots: defaultSlots(),
    marks: defaultMarks(),
    people: [],
    pages: [makePage(columns)],
  };
}

export function makeNote(page: Page): Note {
  // Stack new notes in the right-hand margin, staggering by existing count.
  const n = page.notes.length;
  const w = 150;
  const h = 110;
  const x = Math.min(PAGE_W - w - 12, PAGE_PAD.left + TABLE_W + 14 + (n % 3) * 8);
  const y = PAGE_PAD.top + 96 + (n % 5) * 36;
  return { id: uid("n"), text: "", x, y, w, h, color: NOTE_COLORS[n % NOTE_COLORS.length] };
}

/** Ensure every row has a cell for every non-label column and no orphans. */
export function normalizeSheet(sheet: Sheet): Sheet {
  const colIds = sheet.columns.slice(1).map((c) => c.id);
  for (const page of sheet.pages) {
    for (const row of page.rows) {
      for (const id of colIds) if (!row.cells[id]) row.cells[id] = emptyCell();
      for (const id of Object.keys(row.cells)) if (!colIds.includes(id)) delete row.cells[id];
    }
  }
  return sheet;
}

export function isSheetEmpty(sheet: Sheet): boolean {
  if (sheet.people.length) return false;
  for (const p of sheet.pages) {
    if (p.title || p.headerNote || p.notes.length) return false;
    for (const r of p.rows) {
      if (r.label) return false;
      for (const c of Object.values(r.cells)) if (c.text || c.assignments.length) return false;
    }
  }
  return sheet.pages.length === 1;
}

export function placementCounts(sheet: Sheet): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of sheet.pages)
    for (const r of p.rows)
      for (const c of Object.values(r.cells))
        for (const a of c.assignments) m.set(a.personId, (m.get(a.personId) ?? 0) + 1);
  return m;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
export function formatDateLabel(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local calendar date → "yyyy-mm-dd". */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "yyyy-mm-dd" → local Date (midnight), or null when malformed. */
export function fromISO(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso) ?? new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function todayISO(): string {
  return toISO(new Date());
}

/**
 * Read a date back out of a label such as "11月18日(水)" or "11/18". The year is
 * not in the label: use `refYear`, nudged by a year when the result would be
 * more than six months away from `ref` (sheets are made for the near future).
 */
export function parseDateLabel(label: string, ref: Date = new Date()): string | null {
  const m = /(\d{1,2})\s*[月\/.-]\s*(\d{1,2})/.exec(label);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year = ref.getFullYear();
  let d = new Date(year, month - 1, day);
  const half = 183 * 86400000;
  if (d.getTime() - ref.getTime() > half) year -= 1;
  else if (ref.getTime() - d.getTime() > half) year += 1;
  d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1) return null; // e.g. 2月30日
  return toISO(d);
}

/** Date stored on a row, falling back to what its label says. */
export function rowDate(row: { label: string; date?: string }): string | null {
  return fromISO(row.date) ? row.date! : parseDateLabel(row.label);
}

/**
 * Where the calendar should open for a row: its own date, else the previous
 * row's date + 1 (looking back through earlier pages), else today.
 */
export function suggestedRowDate(pages: { rows: { label: string; date?: string }[] }[], pageIndex: number, rowIndex: number): string {
  const own = rowDate(pages[pageIndex].rows[rowIndex]);
  if (own) return own;
  let p = pageIndex;
  let r = rowIndex - 1;
  let steps = 1; // rows between the dated row and this one
  while (p >= 0) {
    while (r >= 0) {
      const d = rowDate(pages[p].rows[r]);
      if (d) return addDays(d, steps);
      r -= 1;
      steps += 1;
    }
    p -= 1;
    if (p >= 0) r = pages[p].rows.length - 1;
  }
  return todayISO();
}

export function baseFilename(title: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const safe = title
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return `${safe || "shift"}_${stamp}`;
}

/** File name (without extension) for the editable save data, e.g. イベントセーブデータ_20261115. */
export function saveDataFilename(label: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${label}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
