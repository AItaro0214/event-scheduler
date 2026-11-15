# Brief: イベントシフトメーカー (Event Shift Maker)

## Goal
Browser-only web app for building a temporary event/campaign shift sheet on an iPad by drag & drop.
A hand-made reference sheet was shown to the implementer privately; it is not part of this repo.
Only design requirement from the client: **it must feel like a pro app designer built it — comfortable to use, refined and beautiful.** All visual/interaction design decisions are yours.

## Hard constraints
- 100% client-side. No backend, no analytics, no external requests at runtime (no CDN fonts/scripts; bundle or vendor everything). Data never leaves the browser except files the user saves.
- Autosave to localStorage is OK (it stays in the browser).
- Primary device: iPad Safari, landscape and portrait, touch. Must also work with mouse on desktop.
- Drag & drop with **Pointer Events** (not HTML5 DnD — it is unreliable on iOS). Long-press not required; drag should start promptly, page should not scroll while dragging, add touch-action rules accordingly. Big touch targets.
- Stack: Vite + vanilla TS or a light framework of your choice (Preact/Svelte/etc. fine). `npm run build` → `dist/`. Deploy target is Cloudflare Workers static assets (I will do the deploy; just make `dist/` self-contained, relative or root paths both fine).
- Add `wrangler.jsonc`: name `event-shift-maker`, `assets: { directory: "./dist" }`, compatibility_date `2026-11-01`. Add `.assetsignore` not needed since dir is dist. Add `.gitignore` (node_modules, dist).

## Data model (suggested; adjust if you have a better one)
- Sheet: title (e.g. "お客様感謝祭"), header notes area top-right (free text, like "A 13:00〜18:30 …"), columns[], pages[].
- Columns: default 4 — 日付 / 店頭 / ブース / メモ. User can add/remove/reorder/rename columns and resize width.
- Rows: default 7 per page (one per day). User can add/remove rows; first column label editable (date). Option: generate dates from a start date.
- Cell: contains slot groups. **Slot definitions are shared across the whole sheet** (default: 早 / 10中 / 中 / 遅; user can add/edit/delete/reorder). A cell shows only slots that have someone, in definition order, like "早: 田中・桐谷・森".
  Also allow free text in a cell (the メモ column holds text like "A 山本さん・中村さん"), and a cell may be text-only.
- Tasks/marks (shared definitions, editable): defaults お迎え, お見送り, メイク, レ (register), カ, 午後. Each has a short label and a color (レ red circle, カ navy circle, お迎え navy text etc. — see reference). Short single-char marks render as small circled badges; longer ones as small colored text tags.
- People pool: right side panel. Add names (one at a time or paste many, one per line). Reorder, rename, delete. A person can be placed many times (pool is a palette, not consumed). Show a subtle count of how many placements each person has.
- Assignment = {personId, slotId, marks[]} inside a cell.

## Interactions
- Drag a person from the pool onto a cell → popover: choose slot (早/10中/中/遅…) and optionally toggle marks (multi-select), with a confirm. Fast path: tapping a slot with no marks selected should be possible in one tap.
- Tap an existing placed name → same popover to edit slot/marks, or remove. Drag a placed name to another cell/slot to move it (and drag back to the pool / to a trash zone to remove).
- **Mark badges are drawn at the top-right of the name**, like the reference, and must be laid out automatically so they never overlap neighbouring names, other badges or cell borders (adjust spacing/line height or wrap as needed). This auto-balance is a key requirement — do it properly, not with absolute offsets that collide.
- Sticky notes (付箋): add notes anywhere outside the table (margins around the sheet), free text, drag to move, resize, a few colors, delete. They must also appear in the PDF at their positions.
- Pages: "add page" creates a new page with the same columns/slot defs/title format (empty rows). Navigate pages; delete page. Notes belong to a page.
- Undo/redo (at least undo) strongly preferred.

## Save / load
- Button "PDF保存": produces BOTH (1) a PDF of all pages (A4 landscape, one sheet page per PDF page, looking like the on-screen sheet without UI chrome, sticky notes included) and (2) a JSON file with the full state (sheet, pages, people, slot defs, marks, notes, plus `app` and `version` fields). Same base filename derived from title + date.
  PDF: render each page DOM to canvas (html-to-image or html2canvas, bundled) and place into jsPDF at high resolution (scale ≥2) so Japanese text needs no embedded font. Ensure it works on iPad Safari (download via blob/anchor; if iOS opens a new tab or share sheet that's fine; the two downloads may need to be sequential — make sure the JSON one isn't swallowed. A small "保存しました" dialog with two buttons as fallback is acceptable).
- Button "JSON読込": file input, validate, replace state (confirm if current state non-empty). Also a separate "JSONだけ保存" is fine.
- "新規作成" with confirm.

## Japanese UI copy
Do NOT invent Japanese UI text. Put all UI strings in one `COPY` object (src/copy.ts or similar). Use the strings below. If you need a string not listed, add it to COPY with a placeholder value prefixed `TODO:` in English and list it in your report; I will write the Japanese.

```
appName: イベントシフトメーカー
newSheet: 新規作成
confirmNew: いまの内容を消して、新しいシフト表を作りますか？
savePdf: PDF保存
savePdfHint: PDFと、続きから編集できるJSONを保存します
saveJson: JSONだけ保存
loadJson: JSON読込
confirmLoad: いまの内容を、読み込んだファイルの内容に置き換えますか？
loadError: このファイルは読み込めませんでした。イベントシフトメーカーで保存したJSONを選んでください。
saved: 保存しました
undo: 元に戻す
redo: やり直す
people: メンバー
addPerson: メンバーを追加
personPlaceholder: 名前（改行で複数まとめて追加）
peopleEmpty: 名前を追加して、表の枠へドラッグしてください
placedCount: {n}か所
slots: 時間帯
slotsHint: 早・中・遅など、全ての枠で共通の区分
addSlot: 時間帯を追加
marks: 役割
marksHint: 名前の右上に付ける印（お迎え、レ、カ など）
addMark: 役割を追加
markColor: 色
popoverTitle: {name}さんをどこに入れますか？
popoverSlot: 時間帯
popoverMarks: 役割（任意）
place: 入れる
update: 変更する
remove: 外す
cancel: キャンセル
columns: 列
addColumn: 列を追加
columnName: 列の名前
deleteColumn: 列を削除
addRow: 行を追加
deleteRow: 行を削除
fillDates: 開始日から日付を入れる
cellText: 自由記入
cellTextPlaceholder: メモや補足を入力
title: タイトル
titlePlaceholder: 例）お客様感謝祭
headerNote: 欄外のメモ
headerNotePlaceholder: 例）A 13:00〜18:30
addNote: 付箋を追加
notePlaceholder: メモを入力
deleteNote: 付箋を削除
page: {n}ページ
addPage: ページを追加
deletePage: このページを削除
confirmDeletePage: {n}ページ目を削除しますか？
delete: 削除
trash: ここにドロップして外す
privacy: データはこのブラウザの中だけに保存され、外部には送信されません
```
Default column names: 日付 / 店頭 / ブース / メモ. Default slots: 早 / 10中 / 中 / 遅. Default marks: お迎え, お見送り, メイク, レ, カ, 午後.
Seed demo: start empty (no demo people), but with default title placeholder, 7 empty rows.

## Done when
- `npm install && npm run build` exits 0.
- Core flow works in a desktop browser at iPad-like viewport (1180×820) with touch emulation: add people, drag to cell, popover, marks shown top-right without overlap, sticky note drag, add page, PDF+JSON save, JSON reload restores everything. A quick smoke check only — no exhaustive test suite needed.
- Commit to git (local only, do NOT push) in sensible commits.

## REPORT (reply format, English, short)
1. Stack and file layout (≤10 lines)
2. Design decisions (≤10 lines)
3. How mark auto-layout works (≤5 lines)
4. COPY keys you added with TODO and where/length/context
5. Build result (exit code) and what you smoke-checked, with any known gaps
