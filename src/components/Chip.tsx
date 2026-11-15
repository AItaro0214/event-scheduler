import type { MarkDef } from "../types";

/** Single-character marks render as circled badges; longer ones as coloured text tags. */
export function MarkBadge({ mark }: { mark: MarkDef }) {
  const label = mark.label.trim();
  const circ = [...label].length === 1;
  return (
    <i class={`badge ${circ ? "circ" : "tag"}`} style={{ "--c": mark.color }}>
      {label}
    </i>
  );
}

interface ChipProps {
  name: string;
  marks: MarkDef[];
  justPlaced?: boolean;
  onPointerDown?: (e: PointerEvent) => void;
  onClick?: (e: MouseEvent) => void;
  interactive?: boolean;
}

/**
 * A placed name. The marks row sits in normal flow above the name (grid row 1),
 * right-aligned, so it occupies real width/height and can never overlap a
 * neighbouring name, another chip's badges, or the cell border.
 */
export function Chip({ name, marks, justPlaced, onPointerDown, onClick, interactive }: ChipProps) {
  return (
    <span
      class={`chip${marks.length ? " has-marks" : ""}${justPlaced ? " just-placed" : ""}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span class="chip-marks">
        {marks.map((m) => (
          <MarkBadge key={m.id} mark={m} />
        ))}
      </span>
      <span class="chip-name">{name}</span>
    </span>
  );
}
