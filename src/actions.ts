import { emptyCell, formatDateLabel, makeNote, makePage, makeRow, newSheet, uid } from "./model";
import { commit, getSheet, replaceSheet } from "./store";
import type { Assignment, Cell, Note, Page, Row, Sheet } from "./types";
import { MIN_COL_W, TABLE_W } from "./types";

export interface CellRef {
  pageId: string;
  rowId: string;
  colId: string;
}
export interface AssignmentRef extends CellRef {
  assignmentId: string;
}

function findPage(s: Sheet, pageId: string): Page | undefined {
  return s.pages.find((p) => p.id === pageId);
}
function findRow(s: Sheet, ref: CellRef): Row | undefined {
  return findPage(s, ref.pageId)?.rows.find((r) => r.id === ref.rowId);
}
export function findCell(s: Sheet, ref: CellRef): Cell | undefined {
  return findRow(s, ref)?.cells[ref.colId];
}
export function findAssignment(s: Sheet, ref: AssignmentRef): Assignment | undefined {
  return findCell(s, ref)?.assignments.find((a) => a.id === ref.assignmentId);
}

function move<T>(arr: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
}

/** Reorder helper shared by the three definition lists. */
function reorderById<T extends { id: string }>(arr: T[], id: string, targetId: string, before: boolean) {
  const from = arr.findIndex((x) => x.id === id);
  let to = arr.findIndex((x) => x.id === targetId);
  if (from < 0 || to < 0) return;
  if (!before) to += 1;
  if (from < to) to -= 1;
  move(arr, from, to);
}

// ---------------- Sheet / pages ----------------
export const resetSheet = () => replaceSheet(newSheet());

export const setPageTitle = (pageId: string, title: string) =>
  commit((s) => {
    const p = findPage(s, pageId);
    if (p) p.title = title;
  }, `title:${pageId}`);

export const setHeaderNote = (pageId: string, text: string) =>
  commit((s) => {
    const p = findPage(s, pageId);
    if (p) p.headerNote = text;
  }, `hnote:${pageId}`);

export function addPage(afterPageId: string): string {
  let id = "";
  commit((s) => {
    const idx = s.pages.findIndex((p) => p.id === afterPageId);
    const src = s.pages[idx] ?? s.pages[s.pages.length - 1];
    const page = makePage(s.columns, Math.max(1, src.rows.length), src.title, src.headerNote);
    id = page.id;
    s.pages.splice(idx + 1, 0, page);
  });
  return id;
}

export const deletePage = (pageId: string) =>
  commit((s) => {
    if (s.pages.length <= 1) return;
    s.pages = s.pages.filter((p) => p.id !== pageId);
  });

// ---------------- Rows ----------------
export const addRow = (pageId: string) =>
  commit((s) => {
    const p = findPage(s, pageId);
    if (p) p.rows.push(makeRow(s.columns));
  });

export const deleteRow = (pageId: string, rowId: string) =>
  commit((s) => {
    const p = findPage(s, pageId);
    if (p && p.rows.length > 1) p.rows = p.rows.filter((r) => r.id !== rowId);
  });

export const setRowLabel = (pageId: string, rowId: string, label: string) =>
  commit((s) => {
    const r = findPage(s, pageId)?.rows.find((x) => x.id === rowId);
    if (r) r.label = label;
  }, `label:${rowId}`);

export const fillDates = (pageId: string, startISO: string) =>
  commit((s) => {
    const p = findPage(s, pageId);
    if (!p) return;
    const [y, m, d] = startISO.split("-").map(Number);
    if (!y || !m || !d) return;
    p.rows.forEach((row, i) => {
      const dt = new Date(y, m - 1, d + i);
      row.label = formatDateLabel(dt);
    });
  });

// ---------------- Columns ----------------
export const renameColumn = (colId: string, name: string) =>
  commit((s) => {
    const c = s.columns.find((x) => x.id === colId);
    if (c) c.name = name;
  }, `col:${colId}`);

export const addColumn = (name: string) =>
  commit((s) => {
    // Take width from the widest column so the table stays within the page.
    const widest = s.columns.reduce((a, b) => (b.width > a.width ? b : a));
    const w = Math.max(MIN_COL_W, Math.round(widest.width * 0.4));
    widest.width -= w;
    const col = { id: uid("c"), name, width: w };
    s.columns.push(col);
    for (const p of s.pages) for (const r of p.rows) r.cells[col.id] = emptyCell();
  });

export const deleteColumn = (colId: string) =>
  commit((s) => {
    const idx = s.columns.findIndex((c) => c.id === colId);
    if (idx <= 0 || s.columns.length <= 2) return; // label column stays
    const [col] = s.columns.splice(idx, 1);
    const neighbour = s.columns[Math.min(idx, s.columns.length - 1)];
    neighbour.width += col.width;
    for (const p of s.pages) for (const r of p.rows) delete r.cells[colId];
  });

export const moveColumn = (colId: string, dir: -1 | 1) =>
  commit((s) => {
    const idx = s.columns.findIndex((c) => c.id === colId);
    const to = idx + dir;
    if (idx <= 0 || to <= 0 || to >= s.columns.length) return;
    move(s.columns, idx, to);
  });

/** Resize column `idx` by shifting its right border; the neighbour absorbs the difference. */
export const resizeColumn = (idx: number, newWidth: number) =>
  commit((s) => {
    const a = s.columns[idx];
    const b = s.columns[idx + 1];
    if (!a) return;
    if (b) {
      const total = a.width + b.width;
      const w = Math.max(MIN_COL_W, Math.min(total - MIN_COL_W, Math.round(newWidth)));
      a.width = w;
      b.width = total - w;
    } else {
      const others = s.columns.slice(0, -1).reduce((n, c) => n + c.width, 0);
      a.width = Math.max(MIN_COL_W, Math.min(TABLE_W - others, Math.round(newWidth)));
    }
  }, `resize:${idx}`);

// ---------------- Cells / assignments ----------------
export const setCellText = (ref: CellRef, text: string) =>
  commit((s) => {
    const c = findCell(s, ref);
    if (c) c.text = text;
  }, `cell:${ref.rowId}:${ref.colId}`);

export function placeAssignment(ref: CellRef, personId: string, slotId: string, marks: string[]): string {
  const id = uid("a");
  commit((s) => {
    const c = findCell(s, ref);
    if (c) c.assignments.push({ id, personId, slotId, marks });
  });
  return id;
}

export const updateAssignment = (ref: AssignmentRef, slotId: string, marks: string[]) =>
  commit((s) => {
    const a = findAssignment(s, ref);
    if (a) {
      a.slotId = slotId;
      a.marks = marks;
    }
  });

export const removeAssignment = (ref: AssignmentRef) =>
  commit((s) => {
    const c = findCell(s, ref);
    if (c) c.assignments = c.assignments.filter((a) => a.id !== ref.assignmentId);
  });

/** Move an assignment to another cell, optionally changing its slot. */
export const moveAssignment = (from: AssignmentRef, to: CellRef, slotId?: string) =>
  commit((s) => {
    const src = findCell(s, from);
    const dst = findCell(s, to);
    if (!src || !dst) return;
    const i = src.assignments.findIndex((a) => a.id === from.assignmentId);
    if (i < 0) return;
    const [a] = src.assignments.splice(i, 1);
    if (slotId) a.slotId = slotId;
    dst.assignments.push(a);
  });

// ---------------- People ----------------
export const addPeople = (names: string[]) =>
  commit((s) => {
    for (const raw of names) {
      const name = raw.trim();
      if (name) s.people.push({ id: uid("u"), name });
    }
  });

export const renamePerson = (id: string, name: string) =>
  commit((s) => {
    const p = s.people.find((x) => x.id === id);
    if (p) p.name = name;
  }, `person:${id}`);

export const deletePerson = (id: string) =>
  commit((s) => {
    s.people = s.people.filter((x) => x.id !== id);
    for (const p of s.pages)
      for (const r of p.rows)
        for (const c of Object.values(r.cells))
          c.assignments = c.assignments.filter((a) => a.personId !== id);
  });

export const reorderPerson = (id: string, targetId: string, before: boolean) =>
  commit((s) => reorderById(s.people, id, targetId, before));

// ---------------- Slots ----------------
export const addSlot = (name: string) =>
  commit((s) => {
    if (name.trim()) s.slots.push({ id: uid("s"), name: name.trim() });
  });
export const renameSlot = (id: string, name: string) =>
  commit((s) => {
    const x = s.slots.find((d) => d.id === id);
    if (x) x.name = name;
  }, `slot:${id}`);
export const deleteSlot = (id: string) =>
  commit((s) => {
    s.slots = s.slots.filter((d) => d.id !== id);
    for (const p of s.pages)
      for (const r of p.rows)
        for (const c of Object.values(r.cells))
          c.assignments = c.assignments.filter((a) => a.slotId !== id);
  });
export const reorderSlot = (id: string, targetId: string, before: boolean) =>
  commit((s) => reorderById(s.slots, id, targetId, before));

// ---------------- Marks ----------------
export const addMark = (label: string, color: string) =>
  commit((s) => {
    if (label.trim()) s.marks.push({ id: uid("m"), label: label.trim(), color });
  });
export const renameMark = (id: string, label: string) =>
  commit((s) => {
    const x = s.marks.find((d) => d.id === id);
    if (x) x.label = label;
  }, `mark:${id}`);
export const recolorMark = (id: string, color: string) =>
  commit((s) => {
    const x = s.marks.find((d) => d.id === id);
    if (x) x.color = color;
  });
export const deleteMark = (id: string) =>
  commit((s) => {
    s.marks = s.marks.filter((d) => d.id !== id);
    for (const p of s.pages)
      for (const r of p.rows)
        for (const c of Object.values(r.cells))
          for (const a of c.assignments) a.marks = a.marks.filter((m) => m !== id);
  });
export const reorderMark = (id: string, targetId: string, before: boolean) =>
  commit((s) => reorderById(s.marks, id, targetId, before));

// ---------------- Notes ----------------
export function addNote(pageId: string): string {
  let id = "";
  commit((s) => {
    const p = findPage(s, pageId);
    if (!p) return;
    const n = makeNote(p);
    id = n.id;
    p.notes.push(n);
  });
  return id;
}
export const updateNote = (pageId: string, noteId: string, patch: Partial<Note>, coalesce?: string) =>
  commit((s) => {
    const n = findPage(s, pageId)?.notes.find((x) => x.id === noteId);
    if (n) Object.assign(n, patch);
  }, coalesce);
export const deleteNote = (pageId: string, noteId: string) =>
  commit((s) => {
    const p = findPage(s, pageId);
    if (p) p.notes = p.notes.filter((x) => x.id !== noteId);
  });

export { getSheet };
