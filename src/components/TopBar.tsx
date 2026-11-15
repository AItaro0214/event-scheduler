import { COPY, fmt } from "../copy";
import {
  IconChevronL,
  IconChevronR,
  IconDownload,
  IconLogo,
  IconNew,
  IconNote,
  IconPlus,
  IconRedo,
  IconTrash,
  IconUndo,
  IconUpload,
} from "./icons";

interface Props {
  pageIndex: number;
  pageCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onNew: () => void;
  onLoad: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  onAddNote: () => void;
  onSaveJson: () => void;
  onSavePdf: () => void;
}

export function TopBar(p: Props) {
  return (
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">
          <IconLogo width={18} height={18} />
        </span>
        <span class="brand-text">{COPY.appName}</span>
      </div>
      <div class="topbar-group">
        <button type="button" class="btn btn-ghost" onClick={p.onNew}>
          <IconNew />
          {COPY.newSheet}
        </button>
        <button type="button" class="btn btn-ghost" onClick={p.onLoad}>
          <IconUpload />
          {COPY.loadJson}
        </button>
      </div>
      <span class="topbar-sep" />
      <div class="topbar-group">
        <button type="button" class="btn btn-icon btn-ghost" onClick={p.onUndo} disabled={!p.canUndo} title={COPY.undo} aria-label={COPY.undo}>
          <IconUndo />
        </button>
        <button type="button" class="btn btn-icon btn-ghost" onClick={p.onRedo} disabled={!p.canRedo} title={COPY.redo} aria-label={COPY.redo}>
          <IconRedo />
        </button>
      </div>
      <span class="topbar-spacer" />
      <div class="pagenav">
        <button type="button" class="btn btn-icon" onClick={p.onPrevPage} disabled={p.pageIndex === 0} aria-label={COPY.prevPage}>
          <IconChevronL />
        </button>
        <span class="pagenav-label">
          {fmt(COPY.page, { n: p.pageIndex + 1 })} <small>/ {p.pageCount}</small>
        </span>
        <button
          type="button"
          class="btn btn-icon"
          onClick={p.onNextPage}
          disabled={p.pageIndex >= p.pageCount - 1}
          aria-label={COPY.nextPage}
        >
          <IconChevronR />
        </button>
        <button type="button" class="btn btn-icon" onClick={p.onAddPage} title={COPY.addPage} aria-label={COPY.addPage}>
          <IconPlus />
        </button>
        <button
          type="button"
          class="btn btn-icon btn-danger"
          onClick={p.onDeletePage}
          disabled={p.pageCount <= 1}
          title={COPY.deletePage}
          aria-label={COPY.deletePage}
        >
          <IconTrash />
        </button>
      </div>
      <span class="topbar-spacer" />
      <div class="topbar-group">
        <button type="button" class="btn btn-outline" onClick={p.onAddNote}>
          <IconNote />
          {COPY.addNote}
        </button>
        <button type="button" class="btn btn-ghost" onClick={p.onSaveJson}>
          {COPY.saveJson}
        </button>
        <button type="button" class="btn btn-primary" onClick={p.onSavePdf} title={COPY.savePdfHint}>
          <IconDownload />
          {COPY.savePdf}
        </button>
      </div>
    </header>
  );
}
