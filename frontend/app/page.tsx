"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import ActionTile from "@/components/home/ActionTile";
import ClockCard from "@/components/home/ClockCard";
import DayCard from "@/components/home/DayCard";
import UpcomingMeetingRow from "@/components/home/UpcomingMeetingRow";
import RecentMeetingRow from "@/components/home/RecentMeetingRow";
import { CameraIcon, JoinIcon, NotesIcon, ScheduleIcon, ShareIcon } from "@/components/home/TileIcons";
import JoinMeetingModal from "@/components/modals/JoinMeetingModal";
import ShareScreenModal from "@/components/modals/ShareScreenModal";
import { canShareScreen, SHARE_UNSUPPORTED } from "@/lib/shareScreen";
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

type Tab = "upcoming" | "recent";

/** Zoom Workplace home: clock, the five buttons, today's meetings, then upcoming and recent meetings. */
function Dashboard() {
  const toast = useToast();
  const router = useRouter();
  const { user, settings, updateSettings } = useAuth();
  const { upcoming, recent, loading, error, reload } = useMeetings();
  const { startInstant, startExisting, starting } = useStartMeeting();
  // The day card reloads when this number changes.
  const [dayKey, setDayKey] = useState(0);
  const reloadAll = useCallback(async () => {
    setDayKey((k) => k + 1);
    await reload();
  }, [reload]);
  const { openSchedule, openEdit, remove, dialogs } = useScheduleDialogs(reloadAll);
  const [joinOpen, setJoinOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("upcoming");

  // "Start with video" is a personal setting, also changeable on the Settings page.
  const startWithVideo = settings?.start_with_video ?? true;
  const toggleVideoPref = (on: boolean) => {
    updateSettings({ start_with_video: on }).catch((e) => toast((e as Error).message, "error"));
  };
  const start = (code: string) => startExisting(code, { videoOn: startWithVideo });

  return (
    <AppShell>
      <div className="min-h-full px-4 pb-12 pt-8 sm:pt-14">
        <div className="mx-auto max-w-[730px]">
          <ClockCard />

          {/* The five buttons */}
          <div className="mx-auto mt-8 flex max-w-[700px] flex-wrap justify-center gap-x-8 gap-y-6 sm:justify-between sm:gap-x-4">
            <ActionTile
              label="New meeting"
              icon={CameraIcon}
              variant="orange"
              onClick={() => startInstant({ videoOn: startWithVideo })}
              disabled={starting}
              badge={starting ? <Spinner className="h-7 w-7" /> : undefined}
              labelExtra={
                <>
                  <button
                    onClick={() => setNewMenuOpen((o) => !o)}
                    className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-zoom-surface text-zoom-text hover:bg-zoom-border"
                    aria-label="New meeting options"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {newMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setNewMenuOpen(false)} />
                      <div className="absolute left-0 top-[100px] z-40 w-60 animate-fade-up rounded-xl border border-zoom-border bg-white p-2 text-sm shadow-pop">
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-zoom-surface">
                          <input type="checkbox" className="h-4 w-4 accent-zoom-blue" checked={startWithVideo} onChange={(e) => toggleVideoPref(e.target.checked)} />
                          Start with video
                        </label>
                      </div>
                    </>
                  )}
                </>
              }
            />
            <ActionTile label="Join" icon={JoinIcon} onClick={() => setJoinOpen(true)} />
            <ActionTile label="Schedule" icon={ScheduleIcon} onClick={() => openSchedule()} />
            <ActionTile
              label="Share screen"
              icon={ShareIcon}
              onClick={() => (canShareScreen() ? setShareOpen(true) : toast(SHARE_UNSUPPORTED, "info"))}
            />
            <ActionTile label="My Notes" icon={NotesIcon} onClick={() => router.push("/docs")} />
          </div>

          {/* Today's meetings, day by day */}
          <div className="mt-10">
            {user && <DayCard meId={user.id} refreshKey={dayKey} onSchedule={openSchedule} onStart={(m) => start(m.meeting_code)} />}
          </div>

          {/* Upcoming and recent meetings */}
          <section className="mt-6 overflow-hidden rounded-xl border border-zoom-border bg-white">
            <div className="flex items-center gap-1 border-b border-zoom-border px-3">
              {(["upcoming", "recent"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`relative px-3 py-3.5 text-[15px] font-semibold ${tab === t ? "text-zoom-ink" : "text-zoom-muted hover:text-zoom-ink"}`}
                >
                  {t === "upcoming" ? "Upcoming meetings" : "Recent meetings"}
                  {tab === t && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-zoom-blue" />}
                </button>
              ))}
              <Link href={tab === "recent" ? "/meetings?tab=recent" : "/meetings"} className="ml-auto px-2 text-sm font-semibold text-zoom-blue hover:underline">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="flex justify-center py-10 text-zoom-blue"><Spinner /></div>
            ) : error ? (
              <ErrorState message={error} onRetry={reload} />
            ) : tab === "upcoming" ? (
              upcoming.length === 0 ? (
                <EmptyState
                  title="No upcoming meetings"
                  action={<button className="btn-primary mt-3" onClick={() => openSchedule()}>Schedule a meeting</button>}
                />
              ) : (
                <ul className="divide-y divide-zoom-border">
                  {upcoming.slice(0, 5).map((m) => (
                    <UpcomingMeetingRow key={m.id} meeting={m} disabled={starting} onStart={(meeting) => start(meeting.meeting_code)} onEdit={openEdit} onDelete={remove} />
                  ))}
                </ul>
              )
            ) : recent.length === 0 ? (
              <EmptyState title="No recent meetings" />
            ) : (
              <ul className="divide-y divide-zoom-border">
                {recent.slice(0, 5).map((m) => (
                  <RecentMeetingRow key={m.id} meeting={m} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <JoinMeetingModal open={joinOpen} onClose={() => setJoinOpen(false)} />
      <ShareScreenModal open={shareOpen} onClose={() => setShareOpen(false)} />
      {dialogs}
    </AppShell>
  );
}
