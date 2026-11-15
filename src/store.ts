import { useEffect, useReducer } from "preact/hooks";
import { newSheet, normalizeSheet } from "./model";
import type { Sheet } from "./types";
import { parseSavedFile, serializeSheet } from "./io";

const STORAGE_KEY = "event-shift-maker:v1";
const MAX_HISTORY = 120;
const COALESCE_MS = 900;

interface HistoryEntry {
  sheet: Sheet;
  key?: string;
  at: number;
}

let current: Sheet = load();
let undoStack: HistoryEntry[] = [];
let redoStack: Sheet[] = [];
let lastCommit: { key?: string; at: number } = { at: 0 };
const listeners = new Set<() => void>();

function load(): Sheet {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = parseSavedFile(JSON.parse(raw));
      if (parsed) return normalizeSheet(parsed.sheet);
    }
  } catch {
    /* ignore corrupt autosave */
  }
  return newSheet();
}

let saveTimer: number | undefined;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeSheet(current)));
    } catch {
      /* quota or private mode: ignore */
    }
  }, 300);
}

function emit() {
  scheduleSave();
  for (const l of listeners) l();
}

export function getSheet(): Sheet {
  return current;
}

/**
 * Apply a mutation to a cloned copy of the sheet and push the previous state
 * onto the undo stack. `coalesce` merges rapid successive edits (typing) into
 * one undo step.
 */
export function commit(fn: (draft: Sheet) => void, coalesce?: string): void {
  const draft = structuredClone(current);
  fn(draft);
  const now = Date.now();
  const merge =
    coalesce !== undefined &&
    lastCommit.key === coalesce &&
    now - lastCommit.at < COALESCE_MS &&
    undoStack.length > 0;
  if (!merge) {
    undoStack.push({ sheet: current, key: coalesce, at: now });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
  }
  lastCommit = { key: coalesce, at: now };
  redoStack = [];
  current = draft;
  emit();
}

export function replaceSheet(sheet: Sheet): void {
  undoStack.push({ sheet: current, at: Date.now() });
  redoStack = [];
  lastCommit = { at: 0 };
  current = normalizeSheet(sheet);
  emit();
}

export function undo(): void {
  const prev = undoStack.pop();
  if (!prev) return;
  redoStack.push(current);
  current = prev.sheet;
  lastCommit = { at: 0 };
  emit();
}

export function redo(): void {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push({ sheet: current, at: Date.now() });
  current = next;
  lastCommit = { at: 0 };
  emit();
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}
export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function useSheet(): Sheet {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const l = () => force(0);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return current;
}
