import { Fragment } from "preact";
import { useRef } from "preact/hooks";
import {
  addRow,
  resizeColumn,
  setCellText,
  setHeaderNote,
  setPageTitle,
  type AssignmentRef,
  type CellRef,
} from "../actions";
import { COPY } from "../copy";
import { armDrag, wasJustDragging, type DragPayload, type DropTarget, type Point } from "../dnd";
import type { Cell, Column, MarkDef, Page, Row, Sheet } from "../types";
import { AutoText } from "./AutoText";
import { Chip } from "./Chip";
import { IconDots, IconPlus } from "./icons";
import { anchorFromEl, type Anchor } from "./Popover";
import { NotesLayer } from "./Notes";

export interface PageViewProps {
  sheet: Sheet;
  page: Page;
  exportMode?: boolean;
  scale?: number;
  scrollEl?: HTMLElement | null;
  justPlacedId?: string | null;
  selectedNoteId?: string | null;
  onSelectNote?: (id: string | null) => void;
  onChipTap?: (ref: AssignmentRef, anchor: Anchor) => void;
  onDrop?: (payload: DragPayload, target: DropTarget | null, p: Point) => void;
  onColumnTap?: (colIndex: number, anchor: Anchor) => void;
  onRowMenu?: (rowId: string, anchor: Anchor) => void;
  onAddColumn?: (anchor: Anchor) => void;
  onDateTap?: (rowId: string, anchor: Anchor) => void;
}

export function PageView(props: PageViewProps) {
  const { sheet, page, exportMode } = props;
  const cols = sheet.columns.map((c) => `${c.width}px`).join(" ");
  const tableWidth = sheet.columns.reduce((n, c) => n + c.width, 0);
  const pageRef = useRef<HTMLDivElement>(null);

  return (
    <div
      class={`page${exportMode ? " export" : ""}`}
      ref={pageRef}
      style={{ width: "1123px", transform: exportMode || !props.scale ? undefined : `scale(${props.scale})` }}
    >
      <div class="page-pad">
        <div class="page-headnote">
          <AutoText
            static={exportMode}
            value={page.headerNote}
            onInput={(v) => setHeaderNote(page.id, v)}
            placeholder={COPY.headerNotePlaceholder}
            aria-label={COPY.headerNote}
          />
        </div>

        <div class="sheet-table" style={{ "--cols": cols, width: `${tableWidth}px` }}>
          <div class="title-row">
            {exportMode ? (
              <div class="text-static">{page.title}</div>
            ) : (
              <input
                type="text"
                value={page.title}
                placeholder={COPY.titlePlaceholder}
                aria-label={COPY.title}
                onInput={(e) => setPageTitle(page.id, (e.currentTarget as HTMLInputElement).value)}
              />
            )}
          </div>

          <div class="trow header">
            {sheet.columns.map((c, i) => (
              <HeaderCell
                key={c.id}
                col={c}
                index={i}
                scale={props.scale ?? 1}
                exportMode={!!exportMode}
                onTap={props.onColumnTap}
              />
            ))}
            {!exportMode && (
              <button
                type="button"
                class="add-col-btn ui"
                title={COPY.addColumn}
                aria-label={COPY.addColumn}
                onClick={(e) => props.onAddColumn?.(anchorFromEl(e.currentTarget))}
              >
                <IconPlus />
              </button>
            )}
          </div>

          {page.rows.map((row) => (
            <RowView key={row.id} row={row} {...props} />
          ))}
        </div>

        {!exportMode && (
          <button
            type="button"
            class="add-row-btn ui"
            style={{ width: `${tableWidth}px` }}
            onClick={() => addRow(page.id)}
          >
            <IconPlus />
            {COPY.addRow}
          </button>
        )}

        <NotesLayer
          page={page}
          exportMode={!!exportMode}
          scale={props.scale ?? 1}
          pageEl={pageRef}
          selectedId={props.selectedNoteId ?? null}
          onSelect={props.onSelectNote}
        />
      </div>
    </div>
  );
}

function HeaderCell({
  col,
  index,
  scale,
  exportMode,
  onTap,
}: {
  col: Column;
  index: number;
  scale: number;
  exportMode: boolean;
  onTap?: (i: number, a: Anchor) => void;
}) {
  const startResize = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const el = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startW = col.width;
    el.classList.add("active");
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      resizeColumn(index, startW + (ev.clientX - startX) / scale);
    };
    const onUp = () => {
      el.classList.remove("active");
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    e.preventDefault();
  };
  return (
    <div class="tcell hcell">
      <span>{col.name}</span>
      {!exportMode && (
        <>
          <button
            type="button"
            class="hcell-btn ui"
            aria-label={`${col.name} ${COPY.columnMenu}`}
            onClick={(e) => onTap?.(index, anchorFromEl(e.currentTarget))}
          />
          <div class="col-resizer ui" onPointerDown={startResize} aria-hidden />
        </>
      )}
    </div>
  );
}

function RowView(props: PageViewProps & { row: Row }) {
  const { sheet, page, row, exportMode } = props;
  return (
    <div class="trow body">
      {sheet.columns.map((col, i) =>
        i === 0 ? (
          <div class="tcell label-cell" key={col.id}>
            {exportMode ? (
              <div class="text-static">{row.label}</div>
            ) : (
              <button
                type="button"
                class={`label-btn${row.label ? "" : " blank"}`}
                aria-label={`${col.name}: ${COPY.pickDate}`}
                onClick={(e) => props.onDateTap?.(row.id, anchorFromEl(e.currentTarget))}
              >
                {row.label || <span class="label-ph" aria-hidden>{COPY.pickDate}</span>}
              </button>
            )}
          </div>
        ) : (
          <div class="tcell" key={col.id}>
            <CellView
              {...props}
              cell={row.cells[col.id] ?? { text: "", assignments: [] }}
              cellRef={{ pageId: page.id, rowId: row.id, colId: col.id }}
            />
          </div>
        ),
      )}
      {!exportMode && (
        <div class="row-gutter ui">
          <button
            type="button"
            class="gutter-btn"
            aria-label={COPY.rowMenu}
            onClick={(e) => props.onRowMenu?.(row.id, anchorFromEl(e.currentTarget))}
          >
            <IconDots />
          </button>
        </div>
      )}
    </div>
  );
}

function CellView(props: PageViewProps & { cell: Cell; cellRef: CellRef }) {
  const { sheet, cell, cellRef, exportMode } = props;
  const peopleById = new Map(sheet.people.map((p) => [p.id, p]));
  const marksById = new Map(sheet.marks.map((m) => [m.id, m]));
  const dropAttrs = exportMode
    ? {}
    : {
        "data-drop": "cell",
        "data-accept": "person assignment",
        "data-page": cellRef.pageId,
        "data-row": cellRef.rowId,
        "data-col": cellRef.colId,
      };

  return (
    <div
      class="cell"
      {...dropAttrs}
      onClick={
        exportMode
          ? undefined
          : (e) => {
              // Tapping empty cell space focuses the free-text field.
              if (e.target === e.currentTarget && !wasJustDragging())
                e.currentTarget.querySelector<HTMLTextAreaElement>(".cell-text")?.focus();
            }
      }
    >
      {sheet.slots.map((slot) => {
        const items = cell.assignments.filter((a) => a.slotId === slot.id);
        if (!items.length) return null;
        const lineAttrs = exportMode ? {} : { ...dropAttrs, "data-drop": "slotline", "data-slot": slot.id };
        return (
          <div class="slot-line" key={slot.id} {...lineAttrs}>
            <span class="slot-label">{slot.name}:</span>
            {items.map((a, i) => {
              const person = peopleById.get(a.personId);
              if (!person) return null;
              const marks = sheet.marks
                .filter((m) => a.marks.includes(m.id))
                .filter((m): m is MarkDef => !!marksById.get(m.id));
              const ref: AssignmentRef = { ...cellRef, assignmentId: a.id };
              return (
                <Fragment key={a.id}>
                  {i > 0 && <span class="sep">・</span>}
                  <Chip
                    name={person.name}
                    marks={marks}
                    interactive={!exportMode}
                    justPlaced={props.justPlacedId === a.id}
                    onPointerDown={
                      exportMode
                        ? undefined
                        : (e) => {
                            const payload: DragPayload = {
                              kind: "assignment",
                              personId: a.personId,
                              assignmentId: a.id,
                              pageId: cellRef.pageId,
                              rowId: cellRef.rowId,
                              colId: cellRef.colId,
                            };
                            armDrag(e, {
                              payload,
                              ghostFrom: e.currentTarget as HTMLElement,
                              scrollEl: props.scrollEl,
                              onDrop: (t, p) => props.onDrop?.(payload, t, p),
                            });
                          }
                    }
                    onClick={
                      exportMode
                        ? undefined
                        : (e) => {
                            if (wasJustDragging()) return;
                            props.onChipTap?.(ref, anchorFromEl(e.currentTarget as Element));
                          }
                    }
                  />
                </Fragment>
              );
            })}
          </div>
        );
      })}
      <AutoText
        class="cell-text"
        static={exportMode}
        value={cell.text}
        onInput={(v) => setCellText(cellRef, v)}
        placeholder={COPY.cellTextPlaceholder}
        aria-label={COPY.cellText}
      />
    </div>
  );
}
