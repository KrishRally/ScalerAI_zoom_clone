"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import TopNav from "@/components/layout/TopNav";
import WeekGrid from "@/components/calendar/WeekGrid";
import EventDetails from "@/components/calendar/EventDetails";
import RequireAuth from "@/components/providers/RequireAuth";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useNow } from "@/hooks/useNow";
import { useScheduleDialogs } from "@/hooks/useScheduleDialogs";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { api } from "@/lib/api";
import { addDays, startOfDay, startOfWeek } from "@/lib/calendar";
import type { Meeting } from "@/lib/types";

type View = "week" | "day";

/** Zoom's Calendar tab: your meetings on a week (or day) grid. */
function CalendarView() {
  const toast = useToast();
  const now = useNow(60_000) ?? Date.now();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const { startExisting } = useStartMeeting();

  // Phones get the one day view.
  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) setView("day");
  }, []);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const first = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  }, [view, anchor]);

  const load = useCallback(async () => {
    try {
      setMeetings(await api.calendar(days[0], addDays(days[days.length - 1], 1)));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const { openSchedule, openEdit, remove, dialogs } = useScheduleDialogs(load);

  const step = view === "week" ? 7 : 1;
  const label =
    view === "week"
      ? formatRange(days[0], days[6])
      : anchor.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const onSlotClick = (start: Date) => {
    if (start.getTime() < Date.now() - 5 * 60_000) {
      toast("Pick a time in the future to schedule a meeting", "info");
      return;
    }
    openSchedule(start);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      <TopNav />
      <div className="flex flex-wrap items-center gap-2 border-b border-zoom-border px-4 py-3">
        <button className="btn-secondary px-3 py-1.5" onClick={() => setAnchor(startOfDay(new Date()))}>Today</button>
        <div className="flex">
          <button className="rounded-md p-1.5 text-zoom-muted hover:bg-zoom-surface hover:text-zoom-ink" aria-label="Previous" onClick={() => setAnchor((a) => addDays(a, -step))}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button className="rounded-md p-1.5 text-zoom-muted hover:bg-zoom-surface hover:text-zoom-ink" aria-label="Next" onClick={() => setAnchor((a) => addDays(a, step))}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <h1 className="mr-auto text-lg font-bold text-zoom-ink">{label}</h1>
        {loading && <Spinner className="h-4 w-4 text-zoom-blue" />}
        <div className="flex rounded-lg border border-zoom-border p-0.5 text-sm font-semibold">
          {(["day", "week"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 ${view === v ? "bg-zoom-blue text-white" : "text-zoom-muted hover:text-zoom-ink"}`}
            >
              {v === "day" ? "Day" : "Week"}
            </button>
          ))}
        </div>
        <button className="btn-primary px-3 py-1.5" onClick={() => openSchedule()}>
          <Plus className="h-4 w-4" /> Schedule
        </button>
      </div>

      <WeekGrid days={days} meetings={meetings} now={now} onSlotClick={onSlotClick} onEventClick={setSelected} />

      <EventDetails
        meeting={selected}
        onClose={() => setSelected(null)}
        onStart={(m) => {
          setSelected(null);
          startExisting(m.meeting_code);
        }}
        onEdit={(m) => {
          setSelected(null);
          openEdit(m);
        }}
        onDelete={(m) => {
          setSelected(null);
          remove(m);
        }}
      />
      {dialogs}
    </div>
  );
}

/** "October 4 - 10, 2026", or "September 28 - October 4, 2026" across months. */
function formatRange(a: Date, b: Date): string {
  const month = (d: Date) => d.toLocaleDateString([], { month: "long" });
  const left = `${month(a)} ${a.getDate()}`;
  const right = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${month(b)} ${b.getDate()}`;
  const year = a.getFullYear() === b.getFullYear() ? `${b.getFullYear()}` : `${a.getFullYear()} / ${b.getFullYear()}`;
  return `${left} - ${right}, ${year}`;
}

export default function CalendarPage() {
  return (
    <RequireAuth>
      <CalendarView />
    </RequireAuth>
  );
}
