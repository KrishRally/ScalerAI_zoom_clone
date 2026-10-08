"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ListFilter, Plus, RotateCw, Search, X } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import AgendaCard from "@/components/meetings/AgendaCard";
import MeetingDetails from "@/components/meetings/MeetingDetails";
import MiniCalendar, { dayKey } from "@/components/meetings/MiniCalendar";
import RequireAuth from "@/components/providers/RequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useCopy } from "@/hooks/useCopy";
import { useMeetings } from "@/hooks/useMeetings";
import { useScheduleDialogs } from "@/hooks/useScheduleDialogs";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { api } from "@/lib/api";
import { addDays, meetingTimes, startOfDay, startOfWeek } from "@/lib/calendar";
import { formatMeetingCode, isSameDay } from "@/lib/format";
import type { Meeting } from "@/lib/types";

type View = "agenda" | "previous";

// The Agenda shows this many days from the chosen day.
const AGENDA_DAYS = 14;

/** Zoom's Meetings page: a month calendar on the left, your meetings day by day on the right. */
function MeetingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const copy = useCopy();
  const { user } = useAuth();
  const view: View = params.get("tab") === "recent" ? "previous" : "agenda";

  const { upcoming, recent, loading: listsLoading, error, reload: reloadLists } = useMeetings();
  const { startExisting } = useStartMeeting();

  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const [agenda, setAgenda] = useState<Meeting[] | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showEnded, setShowEnded] = useState(true);
  const [menu, setMenu] = useState<"view" | "filter" | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const reloadAll = useCallback(async () => {
    setRefreshKey((k) => k + 1);
    await reloadLists();
  }, [reloadLists]);
  const { openSchedule, openEdit, remove, dialogs } = useScheduleDialogs(reloadAll);

  // The Agenda: the chosen day and the two weeks after it.
  useEffect(() => {
    let stale = false;
    setAgenda(null);
    api
      .calendar(day, addDays(day, AGENDA_DAYS))
      .then((m) => !stale && setAgenda(m))
      .catch(() => !stale && setAgenda([]));
    return () => {
      stale = true;
    };
  }, [day, refreshKey]);

  // Dots on the month calendar for days that have meetings.
  useEffect(() => {
    const gridStart = startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1));
    api
      .calendar(gridStart, addDays(gridStart, 42))
      .then((all) => setBusy(new Set(all.map((m) => dayKey(meetingTimes(m).start)))))
      .catch(() => {});
  }, [month, refreshKey]);

  // "?m=<id>" (from the top bar search or the home page) opens that meeting.
  const pickedId = params.get("m");
  useEffect(() => {
    if (pickedId) setOpenId(Number(pickedId));
  }, [pickedId]);

  const pickDay = (d: Date) => {
    setDay(startOfDay(d));
    setMonth(startOfDay(d));
    if (view !== "agenda") router.replace("/meetings");
  };
  const setView = (v: View) => {
    setMenu(null);
    router.replace(v === "previous" ? "/meetings?tab=recent" : "/meetings");
  };

  // Search and the "show ended meetings" filter.
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const matches = useCallback(
    (m: Meeting) => !q || m.title.toLowerCase().includes(q) || (digits.length >= 3 && m.meeting_code.includes(digits)),
    [q, digits],
  );
  const now = Date.now();
  const isOver = (m: Meeting) => m.status === "ended" || meetingTimes(m).end.getTime() < now;

  const list = useMemo(() => {
    const source = view === "previous" ? recent : agenda ?? [];
    return source
      .filter(matches)
      .filter((m) => view === "previous" || showEnded || !isOver(m))
      .sort((a, b) => {
        const diff = meetingTimes(a).start.getTime() - meetingTimes(b).start.getTime();
        return view === "previous" ? -diff : diff;
      });
    // `now` changes every render; the list only needs to follow the data and filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, recent, agenda, matches, showEnded]);

  // Group by day, like Zoom's Agenda.
  const groups = useMemo(() => {
    const map = new Map<string, { date: Date; items: Meeting[] }>();
    for (const m of list) {
      const start = meetingTimes(m).start;
      const key = dayKey(start);
      if (!map.has(key)) map.set(key, { date: startOfDay(start), items: [] });
      map.get(key)!.items.push(m);
    }
    return Array.from(map.values());
  }, [list]);

  const all = [...(agenda ?? []), ...upcoming, ...recent];
  const opened = openId ? all.find((m) => m.id === openId) ?? null : null;
  const closeDetails = () => {
    setOpenId(null);
    if (pickedId) router.replace(view === "previous" ? "/meetings?tab=recent" : "/meetings");
  };

  // Escape closes the details, like the other dialogs.
  useEffect(() => {
    if (!opened) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDetails();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const loading = view === "previous" ? listsLoading : agenda === null;
  const iconBtn = "rounded-md p-2 text-zoom-text hover:bg-zoom-surface";
  const scheduleOnDay = () => {
    if (day <= startOfDay(new Date())) return openSchedule();
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    openSchedule(start);
  };

  return (
    <AppShell>
      <div className="flex h-full bg-white">
        {/* Left: month calendar */}
        <aside className="hidden w-[330px] shrink-0 flex-col border-r border-zoom-border px-5 pb-5 pt-5 lg:flex">
          <div className="flex items-center">
            <Link href="/calendar" className="flex items-center gap-2 text-[15px] text-zoom-blue hover:underline">
              <CalendarDays className="h-5 w-5" /> Open calendar
            </Link>
            <button
              onClick={scheduleOnDay}
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-zoom-blue text-white hover:bg-zoom-blue-hover"
              aria-label="Schedule a meeting"
              title="Schedule a meeting"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-6">
            <MiniCalendar month={month} selected={day} busy={busy} onMonth={setMonth} onSelect={pickDay} />
          </div>
          {user && (
            <label className="mt-6 flex items-center gap-3 px-2 text-[15px] text-zoom-ink">
              <input type="radio" checked readOnly className="h-4 w-4 accent-zoom-blue" aria-label="Show my meetings" />
              <Avatar name={user.name} color={user.avatar_color} size={28} round />
              {user.name}
            </label>
          )}
          {user && (
            <p className="mt-auto flex items-center gap-4 pt-6 text-sm text-zoom-text">
              Personal meeting ID
              <button onClick={() => copy(user.personal_meeting_id, "Personal Meeting ID")} className="text-zoom-blue hover:underline" title="Copy">
                {formatMeetingCode(user.personal_meeting_id)}
              </button>
            </p>
          )}
        </aside>

        {/* Right: the Agenda */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex flex-wrap items-center gap-1 border-b border-zoom-border px-4 py-3 sm:gap-2 sm:px-6">
            <button onClick={() => pickDay(new Date())} className="flex items-center gap-1.5 rounded-lg border border-zoom-border px-3 py-1.5 text-[15px] text-zoom-text hover:bg-zoom-surface">
              <CalendarDays className="h-4 w-4" /> Today
            </button>
            <button onClick={() => pickDay(addDays(day, -1))} className={iconBtn} aria-label="Previous day"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => pickDay(addDays(day, 1))} className={iconBtn} aria-label="Next day"><ChevronRight className="h-5 w-5" /></button>
            <h1 className="ml-1 mr-auto text-xl font-semibold text-zoom-ink sm:text-2xl">
              {view === "previous" ? "Previous meetings" : day.toLocaleDateString([], { month: "long", year: "numeric" })}
            </h1>

            <button onClick={() => setSearchOpen((o) => !o)} className={`${iconBtn} ${searchOpen ? "bg-zoom-surface" : ""}`} aria-label="Search this list" title="Search this list"><Search className="h-5 w-5" /></button>
            <button onClick={reloadAll} className={iconBtn} aria-label="Refresh"><RotateCw className="h-5 w-5" /></button>
            <button onClick={() => setMenu(menu === "filter" ? null : "filter")} className={iconBtn} aria-label="Filter"><ListFilter className="h-5 w-5" /></button>
            <button onClick={() => setMenu(menu === "view" ? null : "view")} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[15px] text-zoom-ink hover:bg-zoom-surface">
              {view === "previous" ? "Previous" : "Agenda"} <ChevronDown className="h-4 w-4" />
            </button>
            <button onClick={scheduleOnDay} className="flex h-9 w-9 items-center justify-center rounded-full bg-zoom-blue text-white lg:hidden" aria-label="Schedule a meeting">
              <Plus className="h-5 w-5" />
            </button>

            {menu && <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />}
            {menu === "view" && (
              <div className="absolute right-4 top-14 z-20 w-48 animate-fade-up rounded-xl border border-zoom-border bg-white py-1.5 shadow-pop">
                {(["agenda", "previous"] as View[]).map((v) => (
                  <button key={v} onClick={() => setView(v)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-zoom-surface">
                    <span className="w-3 text-zoom-blue">{view === v ? "✓" : ""}</span>
                    {v === "agenda" ? "Agenda" : "Previous meetings"}
                  </button>
                ))}
              </div>
            )}
            {menu === "filter" && (
              <div className="absolute right-24 top-14 z-20 w-56 animate-fade-up rounded-xl border border-zoom-border bg-white p-2 shadow-pop">
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-zoom-surface">
                  <input type="checkbox" className="h-4 w-4 accent-zoom-blue" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} />
                  Show meetings that are over
                </label>
              </div>
            )}
          </div>

          {searchOpen && (
            <div className="border-b border-zoom-border px-4 py-2 sm:px-6">
              <label className="flex items-center gap-2 rounded-lg border border-zoom-border px-3 py-1.5 focus-within:border-zoom-blue">
                <Search className="h-4 w-4 text-zoom-muted" />
                <input
                  autoFocus
                  className="w-full bg-transparent text-sm outline-none placeholder:text-zoom-muted"
                  placeholder="Search by meeting name or ID"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search by meeting name or ID"
                />
                {query && (
                  <button onClick={() => setQuery("")} aria-label="Clear search"><X className="h-4 w-4 text-zoom-muted" /></button>
                )}
              </label>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {loading ? (
              <div className="flex justify-center py-16 text-zoom-blue"><Spinner /></div>
            ) : error && view === "previous" ? (
              <ErrorState message={error} onRetry={reloadAll} />
            ) : groups.length === 0 ? (
              <EmptyState
                title={q ? "No meetings match your search" : view === "previous" ? "No previous meetings" : "No meetings scheduled."}
                action={!q && view === "agenda" ? <button className="btn-primary mt-3" onClick={scheduleOnDay}>Schedule a meeting</button> : undefined}
              />
            ) : (
              groups.map(({ date, items }) => {
                const isTodayGroup = isSameDay(date, new Date());
                // The red "now" line goes after the meetings that are already over.
                const nowIndex = isTodayGroup && view === "agenda" ? items.filter(isOver).length : -1;
                return (
                  <div key={date.toISOString()} className="mb-6">
                    <h2 className="mb-3 text-[17px] font-semibold text-zoom-ink">{dayLabel(date)}</h2>
                    <ul className="space-y-2.5">
                      {items.map((m, i) => (
                        <FragmentWithLine key={m.id} line={i === nowIndex}>
                          <AgendaCard
                            meeting={m}
                            onOpen={(x) => setOpenId(x.id)}
                            onStart={(x) => startExisting(x.meeting_code)}
                            onEdit={openEdit}
                            onDelete={remove}
                          />
                        </FragmentWithLine>
                      ))}
                      {nowIndex === items.length && <NowLine />}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Details of one meeting, including your notes from it */}
      {opened && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && closeDetails()}>
          <div role="dialog" aria-label={opened.title} className="relative max-h-[90vh] w-full max-w-2xl animate-fade-up overflow-y-auto rounded-t-2xl bg-white shadow-pop sm:rounded-2xl">
            <button onClick={closeDetails} className="absolute right-3 top-3 rounded-md p-1.5 text-zoom-muted hover:bg-zoom-surface" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <MeetingDetails
              meeting={opened}
              onStart={(m) => startExisting(m.meeting_code)}
              onEdit={opened.status !== "ended" ? (m) => { closeDetails(); openEdit(m); } : undefined}
              onDelete={(m) => { closeDetails(); remove(m); }}
            />
          </div>
        </div>
      )}
      {dialogs}
    </AppShell>
  );
}

function dayLabel(d: Date): string {
  const today = startOfDay(new Date());
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, addDays(today, 1))) return "Tomorrow";
  if (isSameDay(d, addDays(today, -1))) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

/** The red line that marks the current time in today's list. */
function NowLine() {
  return (
    <li aria-label="Now" className="relative flex items-center py-1">
      <span className="h-2.5 w-2.5 rounded-full bg-[#F2541B]" />
      <span className="h-[2px] flex-1 bg-[#F2541B]" />
    </li>
  );
}

function FragmentWithLine({ line, children }: { line: boolean; children: React.ReactNode }) {
  return (
    <>
      {line && <NowLine />}
      {children}
    </>
  );
}

export default function MeetingsPage() {
  // useSearchParams needs a Suspense boundary in the Next.js app router.
  return (
    <Suspense fallback={null}>
      <RequireAuth>
        <MeetingsView />
      </RequireAuth>
    </Suspense>
  );
}
