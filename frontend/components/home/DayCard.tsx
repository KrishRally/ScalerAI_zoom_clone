"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { addDays, meetingTimes, startOfDay } from "@/lib/calendar";
import { formatMeetingCode, isSameDay, timeRange } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface Props {
  meId: number;
  /** Change this number to reload (after scheduling, editing or deleting). */
  refreshKey: number;
  onSchedule: (start?: Date) => void;
  onStart: (m: Meeting) => void;
}

/** The "Today, Oct 9" card on the Zoom home screen: one day of meetings, with day by day arrows. */
export default function DayCard({ meId, refreshKey, onSchedule, onStart }: Props) {
  const router = useRouter();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const dateInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const found = await api.calendar(day, addDays(day, 1));
      setMeetings(found.sort((a, b) => meetingTimes(a).start.getTime() - meetingTimes(b).start.getTime()));
    } catch {
      setMeetings([]);
    }
  }, [day]);

  useEffect(() => {
    setMeetings(null);
    load();
  }, [load, refreshKey]);

  const today = startOfDay(new Date());
  const isToday = isSameDay(day, today);
  const isPast = day < today;
  const short = day.toLocaleDateString([], { month: "short", day: "numeric" });
  const title = isToday ? `Today, ${short}` : `${day.toLocaleDateString([], { weekday: "short" })}, ${short}`;

  const pickDate = () => {
    const input = dateInput.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  // On a future day, suggest 9 AM that day; today, the form picks the next free slot.
  const scheduleOnDay = () => {
    if (isToday || isPast) return onSchedule();
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    onSchedule(start);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-zoom-border bg-white">
      {/* Header: + and the date */}
      <div className="relative flex h-14 items-center justify-center border-b border-zoom-border bg-zoom-surface px-3">
        <button onClick={scheduleOnDay} className="absolute left-3 rounded-md p-1.5 text-zoom-text hover:bg-black/5" aria-label="Schedule a meeting" title="Schedule a meeting">
          <Plus className="h-5 w-5" />
        </button>
        <button onClick={pickDate} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[17px] font-bold text-zoom-ink hover:bg-black/5" aria-label={`${title}, pick a date`}>
          {title} <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <input
          ref={dateInput}
          type="date"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`}
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m, d] = e.target.value.split("-").map(Number);
            setDay(new Date(y, m - 1, d));
          }}
        />
      </div>

      {/* Toolbar: Today, previous, next, more */}
      <div className="relative flex items-center gap-1 border-b border-zoom-border px-4 py-3">
        <button onClick={() => setDay(today)} className="mr-2 flex items-center gap-1.5 rounded-lg border border-zoom-border px-2.5 py-1 text-sm text-zoom-text hover:bg-zoom-surface">
          <CalendarDays className="h-4 w-4" /> Today
        </button>
        <button onClick={() => setDay((d) => addDays(d, -1))} className="rounded-md p-1.5 text-zoom-text hover:bg-zoom-surface" aria-label="Previous day">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => setDay((d) => addDays(d, 1))} className="rounded-md p-1.5 text-zoom-text hover:bg-zoom-surface" aria-label="Next day">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button onClick={() => setMenuOpen((o) => !o)} className="ml-auto rounded-md p-1.5 text-zoom-text hover:bg-zoom-surface" aria-label="More options">
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-4 top-12 z-20 w-48 animate-fade-up rounded-xl border border-zoom-border bg-white py-1.5 shadow-pop">
              <Link href="/calendar" className="block px-4 py-2 text-sm hover:bg-zoom-surface">Open Calendar</Link>
              <Link href="/meetings" className="block px-4 py-2 text-sm hover:bg-zoom-surface">All meetings</Link>
            </div>
          </>
        )}
      </div>

      {/* The day's meetings */}
      <div className="min-h-[300px]">
        {meetings === null ? (
          <div className="flex h-[300px] items-center justify-center text-zoom-blue"><Spinner /></div>
        ) : meetings.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center px-4 text-center">
            <BeachUmbrella />
            <p className="mt-4 text-zoom-text">No meetings scheduled.</p>
            {!isPast && (
              <button onClick={scheduleOnDay} className="mt-1.5 flex items-center gap-1 text-zoom-blue hover:underline">
                <Plus className="h-4 w-4" /> Schedule a meeting
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-zoom-border">
            {meetings.map((m) => {
              const { start } = meetingTimes(m);
              const ended = m.status === "ended";
              const live = m.status === "live";
              const mine = m.host_id === meId;
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zoom-surface">
                  <button
                    onClick={() => router.push(`/meetings?${ended ? "tab=recent&" : ""}m=${m.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className={`w-1 self-stretch rounded-full ${ended ? "bg-zoom-border" : "bg-zoom-blue"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-zoom-muted">
                        {timeRange(start.toISOString(), m.duration_minutes)}
                        {live && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">LIVE</span>}
                      </span>
                      <span className={`block truncate font-semibold ${ended ? "text-zoom-muted" : "text-zoom-ink"}`}>{m.title}</span>
                      <span className="block text-xs text-zoom-muted">Meeting ID: {formatMeetingCode(m.meeting_code)}</span>
                    </span>
                  </button>
                  {ended ? (
                    <span className="text-xs text-zoom-muted">Ended</span>
                  ) : mine ? (
                    <button onClick={() => onStart(m)} className={live ? "btn-primary px-4 py-1.5" : "btn-secondary px-4 py-1.5"}>
                      Start
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link href="/meetings" className="flex items-center gap-1 border-t border-zoom-border px-5 py-3.5 text-zoom-text hover:bg-zoom-surface">
        Open all meetings <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

/** The beach umbrella picture Zoom shows on a day with no meetings. */
function BeachUmbrella() {
  return (
    <svg width="120" height="104" viewBox="0 0 120 104" aria-hidden="true">
      <ellipse cx="62" cy="90" rx="52" ry="12" fill="#ECEBFA" />
      <path d="M48 70l46-6 4 8-46 6z" fill="#C9C7EE" />
      <path d="M52 73l40-5M55 76l38-5" stroke="#fff" strokeWidth="1.5" />
      <path d="M57 14l-11 80" stroke="#B3B1E3" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 26C26 8 70 2 100 32 82 26 66 26 57 14 44 22 26 24 8 26z" fill="#C2C0EC" />
      <path d="M57 14c-8 6-20 10-32 11M57 14c10 10 26 15 43 18" stroke="#A9A6E0" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
