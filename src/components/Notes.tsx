import type { RefObject } from "preact";
import { deleteNote, updateNote } from "../actions";
import { COPY } from "../copy";
import { NOTE_COLORS } from "../model";
import type { Note, Page } from "../types";
import { PAGE_W } from "../types";
import { IconTrash } from "./icons";

const SWATCH: Record<Note["color"], string> = {
  yellow: "#ffe76a",
  pink: "#ffbfcf",
  green: "#b9e9ae",
  blue: "#bcdcff",
};

interface Props {
  page: Page;
  exportMode: boolean;
  scale: number;
  pageEl: RefObject<HTMLDivElement | null>;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
}

export function NotesLayer({ page, exportMode, scale, pageEl, selectedId, onSelect }: Props) {
  return (
    <>
      {page.notes.map((n) => (
        <NoteView
          key={n.id}
          note={n}
          pageId={page.id}
          exportMode={exportMode}
          scale={scale}
          pageEl={pageEl}
          selected={selectedId === n.id}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function NoteView({
  note,
  pageId,
  exportMode,
  scale,
  pageEl,
  selected,
  onSelect,
}: {
  note: Note;
  pageId: string;
  exportMode: boolean;
  scale: number;
  pageEl: RefObject<HTMLDivElement | null>;
  selected: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const pageH = () => pageEl.current?.offsetHeight ?? 794;

  const drag = (e: PointerEvent, mode: "move" | "resize") => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = e.currentTarget as HTMLElement;
    const sx = e.clientX;
    const sy = e.clientY;
    const start = { ...note };
    el.setPointerCapture(e.pointerId);
    onSelect?.(note.id);
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      if (mode === "move") {
        const x = Math.max(0, Math.min(PAGE_W - start.w, start.x + dx));
        const y = Math.max(0, Math.min(pageH() - start.h, start.y + dy));
        updateNote(pageId, note.id, { x: Math.round(x), y: Math.round(y) }, `note-move:${note.id}`);
      } else {
        const w = Math.max(90, Math.min(PAGE_W - start.x, start.w + dx));
        const h = Math.max(60, Math.min(pageH() - start.y, start.h + dy));
        updateNote(pageId, note.id, { w: Math.round(w), h: Math.round(h) }, `note-size:${note.id}`);
      }
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      class={`note${selected ? " selected" : ""}`}
      data-color={note.color}
      style={{ left: note.x, top: note.y, width: note.w, height: note.h }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!exportMode) onSelect?.(note.id);
      }}
    >
      <div class="note-bar" onPointerDown={exportMode ? undefined : (e) => drag(e, "move")} />
      {exportMode ? (
        <div class="note-text">{note.text}</div>
      ) : (
        <textarea
          class="note-text"
          value={note.text}
          placeholder={COPY.notePlaceholder}
          onInput={(e) =>
            updateNote(pageId, note.id, { text: (e.currentTarget as HTMLTextAreaElement).value }, `note:${note.id}`)
          }
          style={{ overflow: "auto" }}
        />
      )}
      {!exportMode && (
        <div class="note-resize ui" onPointerDown={(e) => drag(e, "resize")} aria-hidden />
      )}
      {!exportMode && selected && (
        <div class="note-tools ui" onPointerDown={(e) => e.stopPropagation()}>
          {NOTE_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              class={`swatch${note.color === c ? " on" : ""}`}
              style={{ "--sw": SWATCH[c] }}
              aria-label={`${COPY.noteColor}: ${c}`}
              onClick={() => updateNote(pageId, note.id, { color: c })}
            />
          ))}
          <button
            type="button"
            class="btn btn-danger"
            aria-label={COPY.deleteNote}
            title={COPY.deleteNote}
            onClick={() => {
              deleteNote(pageId, note.id);
              onSelect?.(null);
            }}
          >
            <IconTrash />
          </button>
        </div>
      )}
    </div>
  );
}
