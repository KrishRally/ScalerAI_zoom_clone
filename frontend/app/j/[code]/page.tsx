"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Lock, Mic, MicOff, Video, VideoOff } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import ZoomLogo from "@/components/ui/ZoomLogo";
import DeviceSelect from "@/components/room/DeviceSelect";
import VideoPreview from "@/components/room/VideoPreview";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { api } from "@/lib/api";
import { formatMeetingCode } from "@/lib/format";
import { rememberJoin } from "@/hooks/useStartMeeting";
import { loadDisplayName, loadShowPreview, saveDisplayName, saveShowPreview } from "@/lib/session";
import type { MeetingLookup } from "@/lib/types";

/**
 * The preview window shown before every meeting, like Zoom's.
 *
 * - Guests land here from invite links (/j/<id>?pwd=...) or the Join dialog.
 *   They don't need an account.
 * - The meeting's owner, when signed in, sees "Start" and joins as host.
 *   The server decides this from the sign in, not from anything on this page.
 *
 * This outer part checks the meeting exists and waits for the account to load,
 * so the camera starts with the right defaults.
 */
function PreJoin() {
  const { code } = useParams<{ code: string }>();
  const { loading } = useAuth();
  const [meeting, setMeeting] = useState<MeetingLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    api
      .lookupMeeting(code)
      .then(setMeeting)
      .catch((e: Error) => setLookupError(e.message));
  }, [code]);

  if (lookupError) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-xl border border-zoom-border bg-white p-8 text-center shadow-card">
          <h1 className="text-xl font-bold text-zoom-ink">Unable to join this meeting</h1>
          <p className="mt-2 text-sm text-zoom-muted">{lookupError}</p>
          <p className="mt-1 text-sm text-zoom-muted">Meeting ID: {formatMeetingCode(code)}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/join" className="btn-secondary">Try another ID</Link>
            <Link href="/" className="btn-primary">Go home</Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (!meeting || loading) {
    return (
      <Shell>
        <div className="flex justify-center py-20 text-zoom-blue"><Spinner className="h-8 w-8" /></div>
      </Shell>
    );
  }

  return <PreJoinForm code={code} meeting={meeting} />;
}

/** Camera preview, device pickers, name and passcode. */
function PreJoinForm({ code, meeting }: { code: string; meeting: MeetingLookup }) {
  const params = useSearchParams();
  const router = useRouter();
  const { user, settings, updateSettings } = useAuth();

  // Only the signed in owner of the meeting starts it as host. If the owner
  // opens an invite link (not the Start button), they most likely want to join
  // as someone else, for example to test from a second tab, so we ask for a
  // name. They can still switch back and join as host.
  const isOwner = !!user && meeting.host_id === user.id;
  const [asGuest, setAsGuest] = useState(() => isOwner && params.get("start") !== "1");
  const isHostStart = isOwner && !asGuest;
  const guestName = () => params.get("name") || loadDisplayName();

  const [name, setName] = useState(() => (user && !asGuest ? user.name : guestName()));
  const [passcode, setPasscode] = useState(params.get("pwd") ?? "");
  const [showPreview, setShowPreview] = useState(() => settings?.show_preview ?? loadShowPreview());
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Links can turn audio or video off; otherwise use the signed in user's defaults.
  const media = useLocalMedia({
    audio: params.get("audio") === "off" ? false : !(settings?.join_muted ?? false),
    video: params.get("video") === "off" ? false : settings?.start_with_video ?? true,
  });

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setJoinError("Please enter your name.");
    setJoining(true);
    setJoinError(null);
    try {
      const me = await api.joinMeeting(code, {
        display_name: name.trim(),
        passcode: isHostStart ? undefined : passcode.trim(),
        is_muted: !media.audioOn,
        is_video_on: media.videoOn,
        as_guest: asGuest || undefined,
      });
      if (!user || asGuest) saveDisplayName(name.trim());
      // Signed in users keep this choice in their settings; guests in this browser.
      if (user) {
        if (settings && settings.show_preview !== showPreview) updateSettings({ show_preview: showPreview }).catch(() => {});
      } else {
        saveShowPreview(showPreview);
      }
      rememberJoin(code, me);
      media.stopAll(); // the room opens the camera again with the same devices
      router.push(`/meeting/${code}`);
    } catch (err) {
      setJoinError((err as Error).message);
      setJoining(false);
    }
  }

  function switchMode(guest: boolean) {
    setAsGuest(guest);
    setName(guest ? guestName() : user?.name ?? "");
    setJoinError(null);
  }

  const ended = meeting.status === "ended" && !isHostStart;
  const locked = meeting.is_locked && !isHostStart;
  const hasVideo = media.videoOn && !!media.stream?.getVideoTracks().length;

  return (
    <Shell>
      <form
        onSubmit={handleJoin}
        className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-zoom-border bg-white shadow-pop"
      >
        {/* Title bar, like Zoom's preview window */}
        <div className="flex items-center justify-between gap-3 border-b border-zoom-border px-4 py-2.5">
          <p className="truncate text-sm font-semibold text-zoom-ink">{meeting.title}</p>
          <p className="shrink-0 text-xs text-zoom-muted">ID {formatMeetingCode(meeting.meeting_code)}</p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {/* Camera preview with the Audio and Video buttons on top */}
          <div className="relative aspect-video overflow-hidden rounded-lg bg-room-tile">
            {hasVideo ? (
              <VideoPreview stream={media.stream} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <Avatar name={name || "Guest"} size={88} />
                {!media.videoOn && <p className="text-sm text-[#B3B3B3]">Your video is off</p>}
              </div>
            )}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 overflow-hidden rounded-lg bg-black/70 text-white">
              <OverlayButton on={media.audioOn} onClick={() => media.toggleAudio()} onIcon={Mic} offIcon={MicOff} label="Audio" />
              <OverlayButton on={media.videoOn} onClick={() => media.toggleVideo()} onIcon={Video} offIcon={VideoOff} label="Video" />
            </div>
          </div>

          {/* Device pickers */}
          <div className="flex flex-col gap-2 rounded-lg bg-zoom-surface p-2 sm:flex-row">
            <DeviceSelect kind="mic" devices={media.mics} value={media.micId} onChange={media.selectMic} />
            <DeviceSelect kind="cam" devices={media.cams} value={media.camId} onChange={media.selectCam} />
          </div>
          {media.error && <p className="text-xs text-zoom-muted">{media.error}</p>}

          {ended ? (
            <p className="rounded-lg bg-zoom-surface p-4 text-sm">This meeting has ended.</p>
          ) : (
            <>
              {!isHostStart && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="name">Your name</label>
                    <input id="name" className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
                  </div>
                  {meeting.requires_passcode && (
                    <div>
                      <label className="label" htmlFor="passcode">Meeting passcode</label>
                      <input
                        id="passcode"
                        type="password"
                        className="input"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Enter meeting passcode"
                      />
                    </div>
                  )}
                </div>
              )}
              {locked && (
                <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <Lock className="h-4 w-4" /> This meeting has been locked by the host.
                </p>
              )}
              {joinError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{joinError}</p>}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-zoom-blue"
                    checked={showPreview}
                    onChange={(e) => setShowPreview(e.target.checked)}
                  />
                  Always show this preview when joining
                </label>
                <button type="submit" className="btn-primary min-w-32 py-2.5" disabled={joining || !name.trim() || locked}>
                  {joining ? <Spinner className="h-4 w-4" /> : isHostStart ? "Start" : "Join"}
                </button>
              </div>
              {!isHostStart && (
                <p className="text-xs text-zoom-muted">Hosted by {meeting.host_name}</p>
              )}
            </>
          )}
          {isOwner && (
            <p className="text-xs text-zoom-muted">
              {asGuest ? `You're signed in as ${user?.name}, the host. ` : "Testing from another tab? "}
              <button type="button" className="font-semibold text-zoom-blue hover:underline" onClick={() => switchMode(!asGuest)}>
                {asGuest ? "Join as host instead" : "Join as a guest instead"}
              </button>
            </p>
          )}
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zoom-surface">
      <header className="flex h-14 items-center border-b border-zoom-border bg-white px-4 sm:px-6">
        <Link href="/"><ZoomLogo /></Link>
      </header>
      <main className="px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

function OverlayButton({
  on,
  onClick,
  onIcon: OnIcon,
  offIcon: OffIcon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  onIcon: typeof Mic;
  offIcon: typeof Mic;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${on ? "Turn off" : "Turn on"} ${label.toLowerCase()}`}
      className="flex w-20 flex-col items-center gap-1 px-3 py-2 text-xs hover:bg-white/10"
    >
      {on ? <OnIcon className="h-5 w-5" /> : <OffIcon className="h-5 w-5 text-zoom-red" />}
      {label}
    </button>
  );
}

export default function PreJoinPage() {
  return (
    <Suspense fallback={null}>
      <PreJoin />
    </Suspense>
  );
}
