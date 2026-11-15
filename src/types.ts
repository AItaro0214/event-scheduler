export const APP_ID = "event-shift-maker";
export const DATA_VERSION = 1;

export interface Person {
  id: string;
  name: string;
}

export interface SlotDef {
  id: string;
  name: string;
}

export interface MarkDef {
  id: string;
  label: string;
  color: string; // hex colour
}

export interface Assignment {
  id: string;
  personId: string;
  slotId: string;
  marks: string[]; // mark ids, rendered in definition order
}

export interface Cell {
  text: string;
  assignments: Assignment[];
}

export interface Column {
  id: string;
  name: string;
  width: number; // logical px on the page
}

export interface Row {
  id: string;
  label: string; // first-column text (date)
  date?: string; // ISO yyyy-mm-dd when the label was set from the calendar (optional; older files omit it)
  cells: Record<string, Cell>; // keyed by column id
}

export type NoteColor = "yellow" | "pink" | "green" | "blue";

export interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: NoteColor;
}

export interface Page {
  id: string;
  title: string;
  headerNote: string;
  rows: Row[];
  notes: Note[];
}

export interface Sheet {
  columns: Column[];
  slots: SlotDef[];
  marks: MarkDef[];
  people: Person[];
  pages: Page[];
}

export interface SavedFile {
  app: typeof APP_ID;
  version: number;
  savedAt: string;
  sheet: Sheet;
}

// Logical page geometry (A4 landscape at 96 dpi).
export const PAGE_W = 1123;
export const PAGE_H = 794;
export const PAGE_PAD = { top: 74, right: 184, bottom: 36, left: 30 };
export const TABLE_W = PAGE_W - PAGE_PAD.left - PAGE_PAD.right; // 909
export const MIN_COL_W = 72;
