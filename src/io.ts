import { NOTE_COLORS } from "./model";
import type { Cell, Column, MarkDef, Note, Page, Person, Row, SavedFile, Sheet, SlotDef } from "./types";
import { APP_ID, DATA_VERSION, MIN_COL_W } from "./types";

export function serializeSheet(sheet: Sheet): SavedFile {
  return { app: APP_ID, version: DATA_VERSION, savedAt: new Date().toISOString(), sheet };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Validate and coerce a parsed JSON value into a SavedFile, or null if it is not ours. */
export function parseSavedFile(data: unknown): SavedFile | null {
  if (!isObj(data) || data.app !== APP_ID) return null;
  if (typeof data.version !== "number" || data.version > DATA_VERSION) return null;
  if (!isObj(data.sheet)) return null;
  const s = data.sheet;
  if (!Array.isArray(s.columns) || !Array.isArray(s.pages)) return null;

  const columns: Column[] = s.columns
    .filter(isObj)
    .map((c) => ({ id: str(c.id), name: str(c.name), width: Math.max(MIN_COL_W, num(c.width, 160)) }))
    .filter((c) => c.id);
  if (columns.length === 0) return null;

  const slots: SlotDef[] = (Array.isArray(s.slots) ? s.slots : [])
    .filter(isObj)
    .map((x) => ({ id: str(x.id), name: str(x.name) }))
    .filter((x) => x.id);
  const marks: MarkDef[] = (Array.isArray(s.marks) ? s.marks : [])
    .filter(isObj)
    .map((x) => ({ id: str(x.id), label: str(x.label), color: str(x.color, "#1f3b8f") }))
    .filter((x) => x.id);
  const people: Person[] = (Array.isArray(s.people) ? s.people : [])
    .filter(isObj)
    .map((x) => ({ id: str(x.id), name: str(x.name) }))
    .filter((x) => x.id);

  const slotIds = new Set(slots.map((x) => x.id));
  const markIds = new Set(marks.map((x) => x.id));
  const peopleIds = new Set(people.map((x) => x.id));

  const parseCell = (c: unknown): Cell => {
    if (!isObj(c)) return { text: "", assignments: [] };
    const assignments = (Array.isArray(c.assignments) ? c.assignments : [])
      .filter(isObj)
      .map((a) => ({
        id: str(a.id),
        personId: str(a.personId),
        slotId: str(a.slotId),
        marks: (Array.isArray(a.marks) ? a.marks : []).filter(
          (m): m is string => typeof m === "string" && markIds.has(m),
        ),
      }))
      .filter((a) => a.id && peopleIds.has(a.personId) && slotIds.has(a.slotId));
    return { text: str(c.text), assignments };
  };

  const pages: Page[] = s.pages.filter(isObj).map((p) => {
    const rows: Row[] = (Array.isArray(p.rows) ? p.rows : []).filter(isObj).map((r) => {
      const cells: Record<string, Cell> = {};
      if (isObj(r.cells)) for (const [k, v] of Object.entries(r.cells)) cells[k] = parseCell(v);
      const date = str(r.date);
      return { id: str(r.id), label: str(r.label), ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}), cells };
    });
    const notes: Note[] = (Array.isArray(p.notes) ? p.notes : []).filter(isObj).map((n) => ({
      id: str(n.id),
      text: str(n.text),
      x: num(n.x, 0),
      y: num(n.y, 0),
      w: Math.max(80, num(n.w, 150)),
      h: Math.max(60, num(n.h, 110)),
      color: NOTE_COLORS.includes(n.color as Note["color"]) ? (n.color as Note["color"]) : "yellow",
    }));
    return { id: str(p.id), title: str(p.title), headerNote: str(p.headerNote), rows, notes };
  });
  if (pages.length === 0) return null;

  return {
    app: APP_ID,
    version: DATA_VERSION,
    savedAt: str(data.savedAt, new Date().toISOString()),
    sheet: { columns, slots, marks, people, pages },
  };
}

export function jsonBlob(sheet: Sheet): Blob {
  return new Blob([JSON.stringify(serializeSheet(sheet), null, 2)], { type: "application/json" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
