import { useState } from "preact/hooks";
import type { AssignmentRef, CellRef } from "../actions";
import { COPY, fmt } from "../copy";
import type { Sheet } from "../types";
import { MarkBadge } from "./Chip";
import { IconCheck } from "./icons";
import { Popover, type Anchor } from "./Popover";

export type AssignIntent =
  | { mode: "new"; personId: string; cell: CellRef; anchor: Anchor }
  | { mode: "edit"; ref: AssignmentRef; anchor: Anchor };

interface Props {
  sheet: Sheet;
  intent: AssignIntent;
  onPlace: (slotId: string, marks: string[]) => void;
  onUpdate: (slotId: string, marks: string[]) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * Slot + marks chooser. New placement: tapping a slot with no marks selected
 * places immediately (one tap). With marks toggled, pick a slot and confirm.
 * Editing: change slot/marks and confirm, or remove.
 */
export function AssignPopover({ sheet, intent, onPlace, onUpdate, onRemove, onClose }: Props) {
  const editing = intent.mode === "edit";
  const existing = editing
    ? sheet.pages
        .find((p) => p.id === intent.ref.pageId)
        ?.rows.find((r) => r.id === intent.ref.rowId)
        ?.cells[intent.ref.colId]?.assignments.find((a) => a.id === intent.ref.assignmentId)
    : undefined;
  const personId = editing ? existing?.personId : intent.personId;
  const person = sheet.people.find((p) => p.id === personId);
  const [slotId, setSlotId] = useState<string | null>(existing?.slotId ?? null);
  const [marks, setMarks] = useState<string[]>(existing?.marks ?? []);

  if (!person || (editing && !existing)) {
    onClose();
    return null;
  }

  const toggleMark = (id: string) =>
    setMarks((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const pickSlot = (id: string) => {
    if (!editing && marks.length === 0) {
      onPlace(id, []);
      return;
    }
    setSlotId(id);
  };

  const commitNew = () => slotId && onPlace(slotId, marks);
  const commitEdit = () => slotId && onUpdate(slotId, marks);

  return (
    <Popover anchor={intent.anchor} onClose={onClose} width={332}>
      <h2 class="pop-title">{fmt(COPY.popoverTitle, { name: person.name })}</h2>
      <div class="pop-label">{COPY.popoverSlot}</div>
      {sheet.slots.length === 0 ? (
        <div class="pop-empty">{COPY.slotEmpty}</div>
      ) : (
        <div class="choice-grid">
          {sheet.slots.map((s) => (
            <button
              type="button"
              key={s.id}
              class={`choice${slotId === s.id ? " on" : ""}`}
              onClick={() => pickSlot(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {sheet.marks.length > 0 && (
        <>
          <div class="pop-label">{COPY.popoverMarks}</div>
          <div class="mark-row">
            {sheet.marks.map((m) => {
              const on = marks.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  class={`mark-toggle${on ? " on" : ""}`}
                  style={{ "--c": m.color }}
                  aria-pressed={on}
                  onClick={() => toggleMark(m.id)}
                >
                  <MarkBadge mark={m} />
                  <span>{m.label}</span>
                  <IconCheck class="check" />
                </button>
              );
            })}
          </div>
        </>
      )}
      <div class="pop-actions">
        {editing && (
          <button type="button" class="btn btn-lg btn-danger" onClick={onRemove}>
            {COPY.remove}
          </button>
        )}
        <button type="button" class="btn btn-lg btn-ghost push" onClick={onClose}>
          {COPY.cancel}
        </button>
        {editing ? (
          <button type="button" class="btn btn-lg btn-primary" disabled={!slotId} onClick={commitEdit}>
            {COPY.update}
          </button>
        ) : (
          <button type="button" class="btn btn-lg btn-primary" disabled={!slotId} onClick={commitNew}>
            {COPY.place}
          </button>
        )}
      </div>
    </Popover>
  );
}
