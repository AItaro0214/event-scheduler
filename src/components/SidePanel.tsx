import { useState } from "preact/hooks";
import {
  addMark,
  addPeople,
  addSlot,
  deleteMark,
  deletePerson,
  deleteSlot,
  recolorMark,
  renameMark,
  renamePerson,
  renameSlot,
  reorderMark,
  reorderPerson,
  reorderSlot,
} from "../actions";
import { COPY, fmt } from "../copy";
import { armDrag, wasJustDragging, type DragPayload, type DropTarget, type Point } from "../dnd";
import { MARK_PALETTE, placementCounts } from "../model";
import type { Sheet } from "../types";
import { MarkBadge } from "./Chip";
import { IconGrip, IconLock, IconPlus, IconX } from "./icons";
import { anchorFromEl, Popover, type Anchor } from "./Popover";

type Tab = "people" | "slots" | "marks";

interface Props {
  sheet: Sheet;
  onDrop: (payload: DragPayload, target: DropTarget | null, p: Point) => void;
}

export function SidePanel({ sheet, onDrop }: Props) {
  const [tab, setTab] = useState<Tab>("people");
  return (
    <aside class="panel" data-drop="pool" data-accept="assignment">
      <div class="tabs" role="tablist">
        {(
          [
            ["people", COPY.people],
            ["slots", COPY.slots],
            ["marks", COPY.marks],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={tab === id}
            class={`tab${tab === id ? " on" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div class="panel-body">
        {tab === "people" && <PeopleTab sheet={sheet} onDrop={onDrop} />}
        {tab === "slots" && <SlotsTab sheet={sheet} onDrop={onDrop} />}
        {tab === "marks" && <MarksTab sheet={sheet} onDrop={onDrop} />}
      </div>
      <div class="panel-foot">
        <p class="privacy">
          <IconLock />
          <span>{COPY.privacy}</span>
        </p>
      </div>
    </aside>
  );
}

/** Reorder drop hint: marks the hovered item with before/after while dragging. */
function hintInsert(target: DropTarget | null, p: Point, last: { el: HTMLElement | null }) {
  if (last.el && last.el !== target?.el) last.el.removeAttribute("data-insert");
  if (target?.type === "reorder-item") {
    const r = target.el.getBoundingClientRect();
    target.el.setAttribute("data-insert", p.y < r.top + r.height / 2 ? "before" : "after");
    last.el = target.el;
  } else {
    last.el = null;
  }
}

function useReorderDrag(list: "people" | "slots" | "marks", onReorder: (id: string, target: string, before: boolean) => void) {
  return (e: PointerEvent, id: string, itemEl: HTMLElement) => {
    const payload: DragPayload = { kind: "reorder", list, id };
    const last = { el: null as HTMLElement | null };
    armDrag(e, {
      payload,
      ghostFrom: itemEl,
      threshold: 4,
      onMove: (t, p) => hintInsert(t, p, last),
      onDrop: (t, p) => {
        last.el?.removeAttribute("data-insert");
        if (t?.type === "reorder-item" && t.data.id && t.data.id !== id) {
          const r = t.el.getBoundingClientRect();
          onReorder(id, t.data.id, p.y < r.top + r.height / 2);
        }
      },
      onEnd: () => last.el?.removeAttribute("data-insert"),
    });
  };
}

function PeopleTab({ sheet, onDrop }: Props) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const counts = placementCounts(sheet);
  const reorder = useReorderDrag("people", reorderPerson);

  const submit = () => {
    const names = draft.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    addPeople(names);
    setDraft("");
  };

  return (
    <>
      <div class="add-form">
        <textarea
          class="field"
          rows={2}
          value={draft}
          placeholder={COPY.personPlaceholder}
          onInput={(e) => {
            const el = e.currentTarget as HTMLTextAreaElement;
            setDraft(el.value);
            el.style.height = "0px";
            el.style.height = `${Math.max(44, el.scrollHeight)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <button type="button" class="btn btn-primary btn-lg btn-block" onClick={submit} disabled={!draft.trim()}>
          <IconPlus />
          {COPY.addPerson}
        </button>
      </div>
      {sheet.people.length === 0 ? (
        <div class="empty">{COPY.peopleEmpty}</div>
      ) : (
        <div class="list">
          {sheet.people.map((p) => {
            const n = counts.get(p.id) ?? 0;
            return (
              <div
                key={p.id}
                class="item draggable"
                data-drop="reorder-item"
                data-accept="reorder:people"
                data-id={p.id}
                onPointerDown={(e) => {
                  const t = e.target as HTMLElement;
                  if (editing === p.id || t.closest("input,button,.grip")) return;
                  const payload: DragPayload = { kind: "person", personId: p.id };
                  const pill = document.createElement("span");
                  pill.className = "person-pill";
                  pill.textContent = p.name;
                  armDrag(e, {
                    payload,
                    ghost: pill,
                    axis: "x",
                    onDrop: (tg, pt) => onDrop(payload, tg, pt),
                  });
                }}
              >
                <span
                  class="grip"
                  aria-hidden
                  onPointerDown={(e) => reorder(e, p.id, (e.currentTarget as HTMLElement).parentElement!)}
                >
                  <IconGrip />
                </span>
                {editing === p.id ? (
                  <input
                    class="item-name"
                    value={p.name}
                    aria-label={COPY.rename}
                    autoFocus
                    onInput={(e) => renamePerson(p.id, (e.currentTarget as HTMLInputElement).value)}
                    onFocus={(e) => (e.currentTarget as HTMLInputElement).select()}
                    onBlur={() => setEditing(null)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && setEditing(null)}
                  />
                ) : (
                  <span
                    class="item-name item-name-static"
                    role="button"
                    tabIndex={0}
                    aria-label={`${p.name}: ${COPY.rename}`}
                    onClick={() => !wasJustDragging() && setEditing(p.id)}
                    onKeyDown={(e) => e.key === "Enter" && setEditing(p.id)}
                  >
                    {p.name}
                  </span>
                )}
                <span class={`item-count${n ? "" : " zero"}`}>{fmt(COPY.placedCount, { n })}</span>
                <button
                  type="button"
                  class="btn-x"
                  aria-label={COPY.delete}
                  onClick={() => deletePerson(p.id)}
                >
                  <IconX />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function SlotsTab({ sheet }: Props) {
  const [draft, setDraft] = useState("");
  const reorder = useReorderDrag("slots", reorderSlot);
  const submit = () => {
    if (!draft.trim()) return;
    addSlot(draft);
    setDraft("");
  };
  return (
    <>
      <p class="panel-hint">{COPY.slotsHint}</p>
      <div class="add-form">
        <div class="add-row">
          <input
            class="field"
            value={draft}
            placeholder={COPY.addSlot}
            onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button type="button" class="btn btn-primary btn-lg" onClick={submit} disabled={!draft.trim()} aria-label={COPY.addSlot}>
            <IconPlus />
          </button>
        </div>
      </div>
      <div class="list">
        {sheet.slots.map((s) => (
          <div key={s.id} class="item" data-drop="reorder-item" data-accept="reorder:slots" data-id={s.id}>
            <span class="grip" aria-hidden onPointerDown={(e) => reorder(e, s.id, (e.currentTarget as HTMLElement).parentElement!)}>
              <IconGrip />
            </span>
            <input
              class="item-name"
              value={s.name}
              aria-label={COPY.rename}
              onInput={(e) => renameSlot(s.id, (e.currentTarget as HTMLInputElement).value)}
            />
            <button type="button" class="btn-x" aria-label={COPY.delete} onClick={() => deleteSlot(s.id)}>
              <IconX />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function MarksTab({ sheet }: Props) {
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState(MARK_PALETTE[0]);
  const [palette, setPalette] = useState<{ id: string | null; anchor: Anchor } | null>(null);
  const reorder = useReorderDrag("marks", reorderMark);
  const submit = () => {
    if (!draft.trim()) return;
    addMark(draft, color);
    setDraft("");
  };
  const paletteFor = palette && (palette.id ? sheet.marks.find((m) => m.id === palette.id)?.color : color);

  return (
    <>
      <p class="panel-hint">{COPY.marksHint}</p>
      <div class="add-form">
        <div class="add-row">
          <button
            type="button"
            class="color-btn btn-outline"
            style={{ borderRadius: "10px", height: "44px", width: "44px" }}
            aria-label={COPY.markColor}
            onClick={(e) => setPalette({ id: null, anchor: anchorFromEl(e.currentTarget) })}
          >
            <span class="color-dot" style={{ "--c": color }} />
          </button>
          <input
            class="field"
            value={draft}
            placeholder={COPY.addMark}
            onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button type="button" class="btn btn-primary btn-lg" onClick={submit} disabled={!draft.trim()} aria-label={COPY.addMark}>
            <IconPlus />
          </button>
        </div>
      </div>
      <div class="list">
        {sheet.marks.map((m) => (
          <div key={m.id} class="item" data-drop="reorder-item" data-accept="reorder:marks" data-id={m.id}>
            <span class="grip" aria-hidden onPointerDown={(e) => reorder(e, m.id, (e.currentTarget as HTMLElement).parentElement!)}>
              <IconGrip />
            </span>
            <span class="mark-preview">
              <MarkBadge mark={m} />
            </span>
            <input
              class="item-name"
              value={m.label}
              aria-label={COPY.rename}
              onInput={(e) => renameMark(m.id, (e.currentTarget as HTMLInputElement).value)}
            />
            <button
              type="button"
              class="color-btn"
              aria-label={COPY.markColor}
              onClick={(e) => setPalette({ id: m.id, anchor: anchorFromEl(e.currentTarget) })}
            >
              <span class="color-dot" style={{ "--c": m.color }} />
            </button>
            <button type="button" class="btn-x" aria-label={COPY.delete} onClick={() => deleteMark(m.id)}>
              <IconX />
            </button>
          </div>
        ))}
      </div>
      {palette && (
        <Popover anchor={palette.anchor} onClose={() => setPalette(null)} sheet={false}>
          <div class="palette">
            {MARK_PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                class={`swatch${paletteFor === c ? " on" : ""}`}
                style={{ "--sw": c }}
                aria-label={c}
                onClick={() => {
                  if (palette.id) recolorMark(palette.id, c);
                  else setColor(c);
                  setPalette(null);
                }}
              />
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}
