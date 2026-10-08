"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import ZoomLogo from "@/components/ui/ZoomLogo";
import VideoPreview from "@/components/room/VideoPreview";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { api } from "@/lib/api";
import { formatMeetingCode } from "@/lib/format";
import { loadDisplayName, saveDisplayName, saveMeetingSession } from "@/lib/session";
import type { MeetingLookup } from "@/lib/types";

/**
 * Where invite links land (/j/<meeting id>?pwd=...).
 * Checks the meeting exists, shows a camera preview, and asks for a name before joining.
 */
function PreJoin() {
  const { code } = useParams<{ code: string }>();
  const params = useSearchParams();
  const router = useRouter();

  const [meeting, setMeeting] = useState<MeetingLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState(params.get("pwd") ?? "");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const media = useLocalMedia({
    audio: params.get("audio") !== "off",
    video: params.get("video") !== "off",
  });

  useEffect(() => {
    setName(params.get("name") || loadDisplayName());
    api
      .lookupMeeting(code)
      .then(setMeeting)
      .catch((e: Error) => setLookupError(e.message));
  }, [code, params]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setJoinError("Please enter your name.");
    setJoining(true);
    setJoinError(null);
    try {
      const me = await api.joinMeeting(code, {
        display_name: name.trim(),
        passcode: passcode.trim(),
        is_muted: !media.audioOn,
        is_video_on: media.videoOn,
      });
      saveDisplayName(name.trim());
      saveMeetingSession(code, {
        participantId: me.id,
        startMuted: !media.audioOn,
        startVideoOn: media.videoOn,
      });
      media.stopAll(); // the room opens the camera again
      router.push(`/meeting/${code}`);
    } catch (err) {
      setJoinError((err as Error).message);
      setJoining(false);
    }
  }

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

  if (!meeting) {
    return (
      <Shell>
        <div className="flex justify-center py-20 text-zoom-blue"><Spinner className="h-8 w-8" /></div>
      </Shell>
    );
  }

  const ended = meeting.status === "ended";

  return (
    <Shell>
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.4fr_1fr] md:items-center md:gap-10">
        {/* Camera preview */}
        <div>
          <div className="relative aspect-video overflow-hidden rounded-xl bg-room-tile">
            {media.videoOn && media.stream?.getVideoTracks().length ? (
              <VideoPreview stream={media.stream} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Avatar name={name || "Guest"} size={88} />
              </div>
            )}
            <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              {name || "Your name"}
            </span>
          </div>
          <div className="mt-4 flex justify-center gap-3">
            <PreviewToggle on={media.audioOn} onClick={() => media.toggleAudio()} onIcon={Mic} offIcon={MicOff} label={media.audioOn ? "Mute" : "Unmute"} />
            <PreviewToggle on={media.videoOn} onClick={() => media.toggleVideo()} onIcon={Video} offIcon={VideoOff} label={media.videoOn ? "Stop Video" : "Start Video"} />
          </div>
          {media.error && <p className="mt-2 text-center text-xs text-zoom-muted">{media.error}</p>}
        </div>

        {/* Details and name */}
        <form onSubmit={handleJoin} className="rounded-xl border border-zoom-border bg-white p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-zoom-muted">
            {meeting.status === "live" ? "Meeting in progress" : "Meeting"}
          </p>
          <h1 className="mt-1 text-xl font-bold text-zoom-ink">{meeting.title}</h1>
          <p className="mt-1 text-sm text-zoom-muted">
            Hosted by {meeting.host_name} · ID {formatMeetingCode(meeting.meeting_code)}
          </p>

          {ended ? (
            <p className="mt-6 rounded-lg bg-zoom-surface p-4 text-sm text-zoom-text">This meeting has ended.</p>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="name">Your name</label>
                <input id="name" className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus />
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
              {joinError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{joinError}</p>}
              <button type="submit" className="btn-primary w-full py-2.5" disabled={joining || !name.trim()}>
                {joining ? <Spinner className="h-4 w-4" /> : "Join"}
              </button>
            </div>
          )}
        </form>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zoom-surface">
      <header className="flex h-14 items-center border-b border-zoom-border bg-white px-4 sm:px-6">
        <Link href="/"><ZoomLogo /></Link>
      </header>
      <main className="px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

function PreviewToggle({
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
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        on ? "bg-white text-zoom-ink shadow-card hover:bg-zoom-border/50" : "bg-zoom-red text-white hover:bg-zoom-red-hover"
      }`}
    >
      {on ? <OnIcon className="h-4 w-4" /> : <OffIcon className="h-4 w-4" />}
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
