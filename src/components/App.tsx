import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  addColumn,
  addNote,
  addPage,
  deleteColumn,
  deletePage,
  deleteRow,
  fillDates,
  moveAssignment,
  moveColumn,
  placeAssignment,
  removeAssignment,
  renameColumn,
  resetSheet,
  updateAssignment,
  type AssignmentRef,
  type CellRef,
} from "../actions";
import { COPY, fmt } from "../copy";
import { useDragKind, type DragPayload, type DropTarget, type Point } from "../dnd";
import { downloadBlob, jsonBlob, parseSavedFile, readFileAsText } from "../io";
import { baseFilename, saveDataFilename, isSheetEmpty, todayISO } from "../model";
import { canRedo, canUndo, redo, replaceSheet, undo, useSheet } from "../store";
import { PAGE_W, type Sheet } from "../types";
import { AssignPopover, type AssignIntent } from "./AssignPopover";
import { IconArrowL, IconArrowR, IconCalendar, IconFile, IconFit, IconTrash, IconZoomIn, IconZoomOut } from "./icons";
import { PageView } from "./PageView";
import { Dialog, Popover, type Anchor } from "./Popover";
import { SidePanel } from "./SidePanel";
import { TopBar } from "./TopBar";

type DialogState =
  | { type: "confirmNew" }
  | { type: "confirmLoad"; sheet: Sheet }
  | { type: "confirmDeletePage"; pageId: string; n: number }
  | { type: "loadError" }
  | { type: "saved"; files: { name: string; url: string }[] };

const ZOOM_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5];

export function App() {
  const sheet = useSheet();
  const [pageIndex, setPageIndex] = useState(0);
  const page = sheet.pages[Math.min(pageIndex, sheet.pages.length - 1)];
  useEffect(() => {
    if (pageIndex > sheet.pages.length - 1) setPageIndex(sheet.pages.length - 1);
  }, [sheet.pages.length, pageIndex]);

  // ---- zoom / scale ----
  const stageRef = useRef<HTMLDivElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [fitScale, setFitScale] = useState(1);
  const [pageH, setPageH] = useState(794);
  const scale = zoom === "fit" ? fitScale : zoom;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const avail = el.clientWidth - 56;
      setFitScale(Math.min(1, Math.max(0.3, avail / PAGE_W)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const wrap = pageWrapRef.current;
    const el = wrap?.firstElementChild as HTMLElement | null;
    if (!el) return;
    const ro = new ResizeObserver(() => setPageH(el.offsetHeight));
    ro.observe(el);
    setPageH(el.offsetHeight);
    return () => ro.disconnect();
  }, [page?.id]);

  const zoomStep = (dir: 1 | -1) => {
    const cur = scale;
    const next =
      dir > 0 ? ZOOM_STEPS.find((z) => z > cur + 0.01) : [...ZOOM_STEPS].reverse().find((z) => z < cur - 0.01);
    if (next) setZoom(next);
  };

  // ---- transient UI ----
  const [assign, setAssign] = useState<AssignIntent | null>(null);
  const [colMenu, setColMenu] = useState<{ index: number; anchor: Anchor } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowId: string; anchor: Anchor } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [justPlaced, setJustPlaced] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState(todayISO());
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useDragKind();

  const flashPlaced = (id: string) => {
    setJustPlaced(id);
    setTimeout(() => setJustPlaced((cur) => (cur === id ? null : cur)), 400);
  };

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- drops ----
  const handleDrop = (payload: DragPayload, target: DropTarget | null, p: Point) => {
    if (!target) return;
    const cellOf = (t: DropTarget): CellRef => ({
      pageId: t.data.page!,
      rowId: t.data.row!,
      colId: t.data.col!,
    });
    if (payload.kind === "person") {
      if (target.type === "cell" || target.type === "slotline") {
        const r = target.el.getBoundingClientRect();
        const anchor = {
          x: Math.max(r.left, Math.min(r.right, p.x)),
          y: Math.max(r.top, Math.min(r.bottom, p.y)),
        };
        setAssign({ mode: "new", personId: payload.personId, cell: cellOf(target), anchor });
      }
      return;
    }
    if (payload.kind === "assignment") {
      const from: AssignmentRef = {
        pageId: payload.pageId,
        rowId: payload.rowId,
        colId: payload.colId,
        assignmentId: payload.assignmentId,
      };
      if (target.type === "trash" || target.type === "pool") {
        removeAssignment(from);
      } else if (target.type === "cell" || target.type === "slotline") {
        const to = cellOf(target);
        const slot = target.type === "slotline" ? target.data.slot : undefined;
        const same = to.pageId === from.pageId && to.rowId === from.rowId && to.colId === from.colId;
        if (same && !slot) return;
        moveAssignment(from, to, slot);
        flashPlaced(from.assignmentId);
      }
    }
  };

  // ---- save / load ----
  const savePdf = async () => {
    if (busy) return;
    setBusy(COPY.exporting);
    try {
      const base = baseFilename(page.title || sheet.pages[0].title);
      const { renderPdf } = await import("../export"); // keeps html2canvas/jsPDF out of the first load
      const pdf = await renderPdf(sheet);
      const json = jsonBlob(sheet);
      downloadBlob(pdf, `${base}.pdf`);
      await new Promise((r) => setTimeout(r, 800));
      const saveName = `${saveDataFilename(COPY.saveDataName)}.json`;
      downloadBlob(json, saveName);
      setDialog({
        type: "saved",
        files: [
          { name: `${base}.pdf`, url: URL.createObjectURL(pdf) },
          { name: saveName, url: URL.createObjectURL(json) },
        ],
      });
    } finally {
      setBusy(null);
    }
  };
  const saveJson = () => {
    downloadBlob(jsonBlob(sheet), `${saveDataFilename(COPY.saveDataName)}.json`);
  };
  const onFileChosen = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const parsed = parseSavedFile(JSON.parse(await readFileAsText(file)));
      if (!parsed) throw new Error("invalid");
      if (isSheetEmpty(sheet)) {
        replaceSheet(parsed.sheet);
        setPageIndex(0);
      } else setDialog({ type: "confirmLoad", sheet: parsed.sheet });
    } catch {
      setDialog({ type: "loadError" });
    }
  };
  const closeDialog = () => {
    if (dialog?.type === "saved") setTimeout(() => dialog.files.forEach((f) => URL.revokeObjectURL(f.url)), 60_000);
    setDialog(null);
  };

  const scaledH = useMemo(() => Math.ceil(pageH * scale), [pageH, scale]);
  const col = colMenu ? sheet.columns[colMenu.index] : null;

  return (
    <div class="app">
      <TopBar
        pageIndex={pageIndex}
        pageCount={sheet.pages.length}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onNew={() => (isSheetEmpty(sheet) ? resetSheet() : setDialog({ type: "confirmNew" }))}
        onLoad={() => fileRef.current?.click()}
        onUndo={undo}
        onRedo={redo}
        onPrevPage={() => setPageIndex((i) => Math.max(0, i - 1))}
        onNextPage={() => setPageIndex((i) => Math.min(sheet.pages.length - 1, i + 1))}
        onAddPage={() => {
          addPage(page.id);
          setPageIndex(pageIndex + 1);
          stageRef.current?.scrollTo({ top: 0 });
        }}
        onDeletePage={() => setDialog({ type: "confirmDeletePage", pageId: page.id, n: pageIndex + 1 })}
        onAddNote={() => setSelectedNote(addNote(page.id))}
        onSaveJson={saveJson}
        onSavePdf={savePdf}
      />
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFileChosen} />

      <div class="main">
        <div
          class="stage"
          ref={stageRef}
          onPointerDown={(e) => {
            if (!(e.target as HTMLElement).closest(".note")) setSelectedNote(null);
          }}
        >
          <div class="stage-inner">
            <div class="page-scaler" ref={pageWrapRef} style={{ width: `${Math.ceil(PAGE_W * scale)}px`, height: `${scaledH}px` }}>
              <PageView
                sheet={sheet}
                page={page}
                scale={scale}
                scrollEl={stageRef.current}
                justPlacedId={justPlaced}
                selectedNoteId={selectedNote}
                onSelectNote={setSelectedNote}
                onChipTap={(ref, anchor) => setAssign({ mode: "edit", ref, anchor })}
                onDrop={handleDrop}
                onColumnTap={(index, anchor) => setColMenu({ index, anchor })}
                onRowMenu={(rowId, anchor) => setRowMenu({ rowId, anchor })}
                onAddColumn={(anchor) => {
                  addColumn("");
                  setColMenu({ index: sheet.columns.length, anchor });
                }}
              />
            </div>
          </div>
          <div class="zoombar">
            <button type="button" class="btn btn-icon" onClick={() => zoomStep(-1)} aria-label={COPY.zoomOut} title={COPY.zoomOut}>
              <IconZoomOut />
            </button>
            <span class="zoombar-value">{Math.round(scale * 100)}%</span>
            <button type="button" class="btn btn-icon" onClick={() => zoomStep(1)} aria-label={COPY.zoomIn} title={COPY.zoomIn}>
              <IconZoomIn />
            </button>
            <button
              type="button"
              class="btn btn-icon"
              onClick={() => setZoom("fit")}
              aria-label={COPY.zoomFit}
              title={COPY.zoomFit}
              disabled={zoom === "fit"}
            >
              <IconFit />
            </button>
          </div>
          <div class={`trashzone${drag.kind === "assignment" ? " show" : ""}`} data-drop="trash" data-accept="assignment">
            <IconTrash />
            {COPY.trash}
          </div>
        </div>
        <SidePanel sheet={sheet} onDrop={handleDrop} />
      </div>

      {assign && (
        <AssignPopover
          sheet={sheet}
          intent={assign}
          onClose={() => setAssign(null)}
          onPlace={(slotId, marks) => {
            if (assign.mode === "new") flashPlaced(placeAssignment(assign.cell, assign.personId, slotId, marks));
            setAssign(null);
          }}
          onUpdate={(slotId, marks) => {
            if (assign.mode === "edit") updateAssignment(assign.ref, slotId, marks);
            setAssign(null);
          }}
          onRemove={() => {
            if (assign.mode === "edit") removeAssignment(assign.ref);
            setAssign(null);
          }}
        />
      )}

      {colMenu && col && (
        <Popover anchor={colMenu.anchor} onClose={() => setColMenu(null)} width={300}>
          <div class="pop-label">{COPY.columnName}</div>
          <input
            class="field"
            value={col.name}
            autoFocus={!col.name}
            onInput={(e) => renameColumn(col.id, (e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === "Enter" && setColMenu(null)}
          />
          {colMenu.index === 0 ? (
            <>
              <div class="pop-label">{COPY.dateStart}</div>
              <input class="field" type="date" value={dateDraft} onInput={(e) => setDateDraft((e.currentTarget as HTMLInputElement).value)} />
              <div class="pop-actions">
                <button
                  type="button"
                  class="btn btn-lg btn-primary grow"
                  disabled={!dateDraft}
                  onClick={() => {
                    fillDates(page.id, dateDraft);
                    setColMenu(null);
                  }}
                >
                  <IconCalendar />
                  {COPY.fillDates}
                </button>
              </div>
            </>
          ) : (
            <>
              <div class="menu-sep" />
              <div class="menu-list">
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    class="btn btn-lg btn-outline grow"
                    disabled={colMenu.index <= 1}
                    aria-label={COPY.moveLeft}
                    onClick={() => {
                      moveColumn(col.id, -1);
                      setColMenu({ ...colMenu, index: colMenu.index - 1 });
                    }}
                  >
                    <IconArrowL />
                  </button>
                  <button
                    type="button"
                    class="btn btn-lg btn-outline grow"
                    disabled={colMenu.index >= sheet.columns.length - 1}
                    aria-label={COPY.moveRight}
                    onClick={() => {
                      moveColumn(col.id, 1);
                      setColMenu({ ...colMenu, index: colMenu.index + 1 });
                    }}
                  >
                    <IconArrowR />
                  </button>
                </div>
                <button
                  type="button"
                  class="menu-item danger"
                  disabled={sheet.columns.length <= 2}
                  onClick={() => {
                    deleteColumn(col.id);
                    setColMenu(null);
                  }}
                >
                  <IconTrash />
                  {COPY.deleteColumn}
                </button>
              </div>
            </>
          )}
        </Popover>
      )}

      {rowMenu && (
        <Popover anchor={rowMenu.anchor} onClose={() => setRowMenu(null)} sheet={false}>
          <div class="menu-list">
            <button
              type="button"
              class="menu-item danger"
              disabled={page.rows.length <= 1}
              onClick={() => {
                deleteRow(page.id, rowMenu.rowId);
                setRowMenu(null);
              }}
            >
              <IconTrash />
              {COPY.deleteRow}
            </button>
          </div>
        </Popover>
      )}

      {dialog?.type === "confirmNew" && (
        <Dialog
          message={COPY.confirmNew}
          onClose={closeDialog}
          actions={
            <>
              <button type="button" class="btn btn-ghost" onClick={closeDialog}>
                {COPY.cancel}
              </button>
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => {
                  resetSheet();
                  setPageIndex(0);
                  closeDialog();
                }}
              >
                {COPY.newSheet}
              </button>
            </>
          }
        />
      )}
      {dialog?.type === "confirmLoad" && (
        <Dialog
          message={COPY.confirmLoad}
          onClose={closeDialog}
          actions={
            <>
              <button type="button" class="btn btn-ghost" onClick={closeDialog}>
                {COPY.cancel}
              </button>
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => {
                  replaceSheet(dialog.sheet);
                  setPageIndex(0);
                  closeDialog();
                }}
              >
                {COPY.loadJson}
              </button>
            </>
          }
        />
      )}
      {dialog?.type === "confirmDeletePage" && (
        <Dialog
          message={fmt(COPY.confirmDeletePage, { n: dialog.n })}
          onClose={closeDialog}
          actions={
            <>
              <button type="button" class="btn btn-ghost" onClick={closeDialog}>
                {COPY.cancel}
              </button>
              <button
                type="button"
                class="btn btn-primary"
                style={{ background: "var(--danger)" }}
                onClick={() => {
                  deletePage(dialog.pageId);
                  closeDialog();
                }}
              >
                {COPY.delete}
              </button>
            </>
          }
        />
      )}
      {dialog?.type === "loadError" && (
        <Dialog
          message={COPY.loadError}
          onClose={closeDialog}
          actions={
            <button type="button" class="btn btn-primary" onClick={closeDialog}>
              {COPY.ok}
            </button>
          }
        />
      )}
      {dialog?.type === "saved" && (
        <Dialog
          title={COPY.saved}
          onClose={closeDialog}
          actions={
            <button type="button" class="btn btn-primary" onClick={closeDialog}>
              {COPY.ok}
            </button>
          }
        >
          <div class="file-links">
            {dialog.files.map((f) => (
              <a key={f.name} class="file-link" href={f.url} download={f.name} rel="noopener">
                <IconFile />
                <span>{f.name}</span>
              </a>
            ))}
          </div>
        </Dialog>
      )}

      {busy && (
        <div class="busy" role="status">
          <div class="busy-card">
            <span class="spinner" />
            {busy}
          </div>
        </div>
      )}
    </div>
  );
}
