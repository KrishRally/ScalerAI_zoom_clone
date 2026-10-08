"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import TopNav from "@/components/layout/TopNav";
import MeetingDetails from "@/components/meetings/MeetingDetails";
import Spinner from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useMeetings } from "@/hooks/useMeetings";
import { useScheduleDialogs } from "@/hooks/useScheduleDialogs";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import RequireAuth from "@/components/providers/RequireAuth";
import { formatMeetingCode, formatTime, relativeDay, timeRange } from "@/lib/format";
import type { Meeting } from "@/lib/types";

type Tab = "upcoming" | "recent";

/** Zoom's Meetings tab: a list on the left, details of the selected meeting on the right. */
function MeetingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "recent" ? "recent" : "upcoming";

  const { upcoming, recent, loading, error, reload } = useMeetings();
  const { startExisting, starting } = useStartMeeting();
  const { openSchedule, openEdit, remove, dialogs } = useScheduleDialogs(reload);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // On small screens we show either the list or the details, not both.
  const [showDetailsOnMobile, setShowDetailsOnMobile] = useState(false);

  const list = tab === "upcoming" ? upcoming : recent;
  const selected = list.find((m) => m.id === selectedId) ?? list[0] ?? null;

  useEffect(() => setShowDetailsOnMobile(false), [tab]);

  // Group meetings under day headings, like Zoom.
  const groups = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of list) {
      const when = (tab === "upcoming" ? m.scheduled_start : m.started_at) ?? m.created_at;
      const day = relativeDay(when);
      map.set(day, [...(map.get(day) ?? []), m]);
    }
    return Array.from(map.entries());
  }, [list, tab]);

  const switchTab = (t: Tab) => {
    setSelectedId(null);
    router.replace(t === "recent" ? "/meetings?tab=recent" : "/meetings");
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <TopNav />
      <div className="flex min-h-0 flex-1">
        {/* List */}
        <aside
          className={`w-full flex-col border-r border-zoom-border md:flex md:w-[360px] lg:w-[400px] ${
            showDetailsOnMobile ? "hidden" : "flex"
          }`}
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h1 className="text-lg font-bold text-zoom-ink">Meetings</h1>
            <button className="btn-primary px-3 py-1.5" onClick={() => openSchedule()}>
              <Plus className="h-4 w-4" /> Schedule
            </button>
          </div>
          <div className="flex gap-1 border-b border-zoom-border px-4">
            {(["upcoming", "recent"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`relative px-3 py-2.5 text-sm font-semibold ${
                  tab === t ? "text-zoom-blue" : "text-zoom-muted hover:text-zoom-ink"
                }`}
              >
                {t === "upcoming" ? "Upcoming" : "Previous"}
                {tab === t && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-zoom-blue" />}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10 text-zoom-blue"><Spinner /></div>
            ) : error ? (
              <ErrorState message={error} onRetry={reload} />
            ) : list.length === 0 ? (
              <EmptyState
                title={tab === "upcoming" ? "No upcoming meetings" : "No previous meetings"}
                action={tab === "upcoming" ? <button className="btn-primary mt-3" onClick={() => openSchedule()}>Schedule a meeting</button> : undefined}
              />
            ) : (
              groups.map(([day, meetings]) => (
                <div key={day}>
                  <p className="sticky top-0 bg-zoom-surface px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-zoom-muted">
                    {day}
                  </p>
                  <ul>
                    {meetings.map((m) => {
                      const active = selected?.id === m.id;
                      return (
                        <li key={m.id}>
                          <button
                            onClick={() => {
                              setSelectedId(m.id);
                              setShowDetailsOnMobile(true);
                            }}
                            className={`w-full border-l-[3px] px-4 py-3 text-left transition-colors ${
                              active ? "border-zoom-blue bg-zoom-blue-light" : "border-transparent hover:bg-zoom-surface"
                            }`}
                          >
                            <p className="text-xs font-semibold text-zoom-muted">
                              {tab === "upcoming" && m.scheduled_start
                                ? timeRange(m.scheduled_start, m.duration_minutes)
                                : m.started_at && formatTime(m.started_at)}
                            </p>
                            <p className="truncate font-bold text-zoom-ink">{m.title}</p>
                            <p className="text-xs text-zoom-muted">Meeting ID: {formatMeetingCode(m.meeting_code)}</p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Details */}
        <section className={`min-w-0 flex-1 overflow-y-auto md:block ${showDetailsOnMobile ? "block" : "hidden"}`}>
          <button
            className="flex items-center gap-1 px-4 pt-4 text-sm font-semibold text-zoom-blue md:hidden"
            onClick={() => setShowDetailsOnMobile(false)}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {selected ? (
            <MeetingDetails
              meeting={selected}
              starting={starting}
              onStart={(m) => startExisting(m.meeting_code)}
              onEdit={tab === "upcoming" ? openEdit : undefined}
              onDelete={remove}
            />
          ) : (
            !loading && <EmptyState title="Select a meeting to see its details" />
          )}
        </section>
      </div>
      {dialogs}
    </div>
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
