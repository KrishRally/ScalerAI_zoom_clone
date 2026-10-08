"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { addDays, startOfDay, startOfWeek } from "@/lib/calendar";
import { isSameDay } from "@/lib/format";

interface Props {
  /** Any day in the month being shown. */
  month: Date;
  selected: Date;
  /** Days that have meetings ("2026-10-14"), shown with a small dot. */
  busy: Set<string>;
  onMonth: (month: Date) => void;
  onSelect: (day: Date) => void;
}

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const shiftMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/** The small month calendar on the left of Zoom's Meetings page. */
export default function MiniCalendar({ month, selected, busy, onMonth, onSelect }: Props) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)); // always 6 rows, like Zoom
  const today = startOfDay(new Date());
  const navBtn = "rounded p-1 text-zoom-text hover:bg-zoom-surface";

  return (
    <div>
      <div className="flex items-center gap-1 px-1">
        <button className={navBtn} onClick={() => onMonth(shiftMonths(month, -12))} aria-label="Previous year"><ChevronsLeft className="h-4 w-4" /></button>
        <button className={navBtn} onClick={() => onMonth(shiftMonths(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
        <p className="flex-1 text-center text-[15px] font-semibold text-zoom-ink">
          {month.toLocaleDateString([], { month: "long", year: "numeric" })}
        </p>
        <button className={navBtn} onClick={() => onMonth(shiftMonths(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        <button className={navBtn} onClick={() => onMonth(shiftMonths(month, 12))} aria-label="Next year"><ChevronsRight className="h-4 w-4" /></button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-[13px]">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="pb-2 text-zoom-muted">{d}</span>
        ))}
        {days.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selected);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              aria-label={d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              aria-pressed={isSelected}
              className="group flex flex-col items-center py-1"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  isSelected
                    ? "bg-zoom-blue-light font-bold text-zoom-blue ring-1 ring-zoom-blue/40"
                    : isToday
                      ? "font-bold text-zoom-blue"
                      : inMonth
                        ? "text-zoom-text group-hover:bg-zoom-surface"
                        : "text-zoom-muted/70 group-hover:bg-zoom-surface"
                }`}
              >
                {d.getDate()}
              </span>
              <span className={`mt-0.5 h-1 w-1 rounded-full ${busy.has(dayKey(d)) ? "bg-zoom-blue/60" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
