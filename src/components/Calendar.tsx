import { useState } from "preact/hooks";
import { COPY, fmt } from "../copy";
import { fromISO, toISO, todayISO } from "../model";
import { IconChevronL, IconChevronR } from "./icons";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface Props {
  /** Selected day (ISO) or null. */
  value: string | null;
  onPick: (iso: string) => void;
}

/**
 * Month-grid date picker (Sun–Sat), sized for fingers. The visible month
 * follows `value` when it changes from outside; arrows move month by month.
 */
export function Calendar({ value, onPick }: Props) {
  const today = todayISO();
  const anchor = fromISO(value) ?? fromISO(today)!;
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });
  const [followed, setFollowed] = useState(value);
  if (value !== followed) {
    // Keep the grid on the month of a newly selected/suggested date.
    setFollowed(value);
    const d = fromISO(value);
    if (d) setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  const first = new Date(view.y, view.m, 1);
  const lead = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.y, view.m, d));
  while (cells.length % 7) cells.push(null);

  const shift = (n: number) => {
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div class="cal">
      <div class="cal-head">
        <button type="button" class="btn btn-icon" onClick={() => shift(-1)} aria-label={COPY.prevMonth} title={COPY.prevMonth}>
          <IconChevronL />
        </button>
        <div class="cal-title">{fmt(COPY.monthTitle, { y: view.y, m: view.m + 1 })}</div>
        <button type="button" class="btn btn-icon" onClick={() => shift(1)} aria-label={COPY.nextMonth} title={COPY.nextMonth}>
          <IconChevronR />
        </button>
      </div>
      <div class="cal-grid" role="grid">
        {WEEKDAYS.map((w, i) => (
          <div key={w} class={`cal-dow${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} class="cal-day empty" />;
          const iso = toISO(d);
          const dow = d.getDay();
          const cls = [
            "cal-day",
            dow === 0 ? "sun" : dow === 6 ? "sat" : "",
            iso === today ? "today" : "",
            iso === value ? "on" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button type="button" key={iso} class={cls} onClick={() => onPick(iso)} aria-pressed={iso === value}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div class="cal-foot">
        <button
          type="button"
          class="btn btn-sm btn-ghost"
          onClick={() => {
            const t = fromISO(today)!;
            setView({ y: t.getFullYear(), m: t.getMonth() });
            onPick(today);
          }}
        >
          {COPY.today}
        </button>
      </div>
    </div>
  );
}
