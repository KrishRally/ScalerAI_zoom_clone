"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ChevronDown, MonitorUp, Plus, Video } from "lucide-react";
import TopNav from "@/components/layout/TopNav";
import ActionTile from "@/components/home/ActionTile";
import ClockCard from "@/components/home/ClockCard";
import UpcomingMeetingRow from "@/components/home/UpcomingMeetingRow";
import RecentMeetingRow from "@/components/home/RecentMeetingRow";
import JoinMeetingModal from "@/components/modals/JoinMeetingModal";
import Spinner from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useMeetings } from "@/hooks/useMeetings";
import { useScheduleDialogs } from "@/hooks/useScheduleDialogs";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import RequireAuth from "@/components/providers/RequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";

export default function HomePage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const toast = useToast();
  const { upcoming, recent, loading, error, reload } = useMeetings();
  const { startInstant, startExisting, starting } = useStartMeeting();
  const { openSchedule, openEdit, remove, dialogs } = useScheduleDialogs(reload);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  // "Start with video" is a personal setting, also changeable on the Settings page.
  const { settings, updateSettings } = useAuth();
  const startWithVideo = settings?.start_with_video ?? true;
  const toggleVideoPref = (on: boolean) => {
    updateSettings({ start_with_video: on }).catch((e) => toast((e as Error).message, "error"));
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-12">
          {/* The four big action buttons */}
          <section className="flex items-center justify-center lg:items-start lg:pt-10">
            <div className="grid grid-cols-2 gap-x-10 gap-y-7 sm:gap-x-14 sm:gap-y-9">
              <ActionTile
                label="New meeting"
                icon={Video}
                variant="orange"
                onClick={() => startInstant({ videoOn: startWithVideo })}
                disabled={starting}
                badge={starting ? <Spinner className="h-7 w-7" /> : undefined}
                accessory={
                  <>
                    <button
                      onClick={() => setNewMenuOpen((o) => !o)}
                      className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-zoom-orange text-white hover:bg-zoom-orange-hover"
                      aria-label="New meeting options"
                    >
                      <ChevronDown className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                    {newMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setNewMenuOpen(false)} />
                        <div className="absolute left-0 top-[88px] z-40 w-60 animate-fade-up rounded-xl border border-zoom-border bg-white p-2 text-sm shadow-pop">
                          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-zoom-surface">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-zoom-blue"
                              checked={startWithVideo}
                              onChange={(e) => toggleVideoPref(e.target.checked)}
                            />
                            Start with video
                          </label>
                        </div>
                      </>
                    )}
                  </>
                }
              />
              <ActionTile label="Join" icon={Plus} onClick={() => setJoinOpen(true)} />
              <ActionTile label="Schedule" icon={CalendarDays} onClick={openSchedule} />
              <ActionTile
                label="Share screen"
                icon={MonitorUp}
                onClick={() => toast("Start or join a meeting first, then click Share Screen in the meeting.", "info")}
              />
            </div>
          </section>

          {/* Clock and today's meetings */}
          <section className="min-w-0 space-y-4">
            <ClockCard />
            <div className="rounded-xl border border-zoom-border bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-zoom-border px-4 py-3">
                <h2 className="font-bold text-zoom-ink">Upcoming meetings</h2>
                <Link href="/meetings" className="text-sm font-semibold text-zoom-blue hover:underline">
                  View all
                </Link>
              </div>
              {loading ? (
                <div className="flex justify-center py-10 text-zoom-blue"><Spinner /></div>
              ) : error ? (
                <ErrorState message={error} onRetry={reload} />
              ) : upcoming.length === 0 ? (
                <EmptyState
                  title="No upcoming meetings"
                  action={<button className="btn-primary mt-3" onClick={openSchedule}>Schedule a meeting</button>}
                />
              ) : (
                <ul className="divide-y divide-zoom-border">
                  {upcoming.slice(0, 5).map((m) => (
                    <UpcomingMeetingRow
                      key={m.id}
                      meeting={m}
                      disabled={starting}
                      onStart={(meeting) => startExisting(meeting.meeting_code, { videoOn: startWithVideo })}
                      onEdit={openEdit}
                      onDelete={remove}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Recent meetings */}
        <section className="mt-8 rounded-xl border border-zoom-border bg-white shadow-card lg:mt-10">
          <div className="flex items-center justify-between border-b border-zoom-border px-4 py-3">
            <h2 className="font-bold text-zoom-ink">Recent meetings</h2>
            <Link href="/meetings?tab=recent" className="text-sm font-semibold text-zoom-blue hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-10 text-zoom-blue"><Spinner /></div>
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : recent.length === 0 ? (
            <EmptyState title="No recent meetings" />
          ) : (
            <ul className="grid divide-y divide-zoom-border md:grid-cols-2 md:divide-y-0">
              {recent.slice(0, 6).map((m) => (
                <RecentMeetingRow key={m.id} meeting={m} />
              ))}
            </ul>
          )}
        </section>
      </main>

      <JoinMeetingModal open={joinOpen} onClose={() => setJoinOpen(false)} />
      {dialogs}
    </div>
  );
}
