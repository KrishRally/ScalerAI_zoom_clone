"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LayoutGrid, ShieldCheck, User as UserIcon, WifiOff } from "lucide-react";
import ControlBar from "@/components/room/ControlBar";
import ChatPanel from "@/components/room/ChatPanel";
import MeetingInfo from "@/components/room/MeetingInfo";
import MeetingStage, { type ViewMode } from "@/components/room/MeetingStage";
import ParticipantsPanel from "@/components/room/ParticipantsPanel";
import RoomEndScreen from "@/components/room/RoomEndScreen";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useCopy } from "@/hooks/useCopy";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useMeetingRoom } from "@/hooks/useMeetingRoom";
import { useNow } from "@/hooks/useNow";
import { api } from "@/lib/api";
import { elapsed, invitationText } from "@/lib/format";
import { clearMeetingSession, loadMeetingSession, type MeetingSession } from "@/lib/session";
import type { Participant } from "@/lib/types";

export default function MeetingPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [session, setSession] = useState<MeetingSession | null>(null);

  // This tab must have joined through the join screen (or Start) first.
  useEffect(() => {
    const saved = loadMeetingSession(code);
    if (saved) setSession(saved);
    else router.replace(`/j/${code}`);
  }, [code, router]);

  if (!session) return <Loading />;
  return <Room code={code} session={session} />;
}

function Room({ code, session }: { code: string; session: MeetingSession }) {
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const now = useNow(1000);
  const pid = session.participantId;

  const room = useMeetingRoom(code, pid);
  const media = useLocalMedia({ audio: !session.startMuted, video: session.startVideoOn });
  const { meeting, me, participants, messages, endReason, patchMe } = room;

  const [panel, setPanel] = useState<"participants" | "chat" | null>(null);
  const [view, setView] = useState<ViewMode>("gallery");
  const [viewMenu, setViewMenu] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [reaction, setReaction] = useState<{ emoji: string; id: number } | null>(null);
  const isHost = me?.role === "host";

  // ---- Keep the server in step with our mic and camera ----
  const lastLocalChange = useRef(0);
  useEffect(() => {
    lastLocalChange.current = Date.now();
    patchMe({ is_muted: !media.audioOn, is_video_on: media.videoOn });
    api.updateSelf(pid, { is_muted: !media.audioOn, is_video_on: media.videoOn }).catch(() => {});
  }, [media.audioOn, media.videoOn, pid, patchMe]);

  // If the host muted us, the server says muted while our mic is still on.
  // Ignore this for a few seconds after our own change, in case the poll was out of date.
  const serverMuted = me?.is_muted;
  const { audioOn, toggleAudio } = media;
  useEffect(() => {
    if (serverMuted && audioOn && Date.now() - lastLocalChange.current > 4000) {
      toggleAudio(false);
      toast("The host has muted you", "info");
    }
  }, [serverMuted, audioOn, toggleAudio, toast]);

  // ---- When the meeting is over for us, release the camera ----
  const { stopAll } = media;
  useEffect(() => {
    if (endReason) {
      stopAll();
      screen?.getTracks().forEach((t) => t.stop());
      clearMeetingSession(code);
    }
  }, [endReason, stopAll, screen, code]);

  // Stop screen sharing if we navigate away while sharing.
  const screenRef = useRef<MediaStream | null>(null);
  screenRef.current = screen;
  useEffect(() => () => screenRef.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => {
    if (meeting) document.title = `${meeting.title} - Zoom`;
  }, [meeting]);

  // ---- Unread chat badge ----
  const seenMessages = useRef<number | null>(null);
  if (meeting && seenMessages.current === null) seenMessages.current = messages.length; // history is not "unread"
  useEffect(() => {
    if (panel === "chat") seenMessages.current = messages.length;
  }, [panel, messages.length]);
  const unread = panel === "chat" ? 0 : Math.max(0, messages.length - (seenMessages.current ?? 0));

  // Our own tile uses the live device state so it never lags behind the server.
  const people: Participant[] = useMemo(
    () =>
      participants.map((p) =>
        p.id === pid ? { ...p, is_muted: !media.audioOn, is_video_on: media.videoOn } : p,
      ),
    [participants, pid, media.audioOn, media.videoOn],
  );

  // ---- Actions ----
  const toggleShare = useCallback(async () => {
    if (screen) {
      screen.getTracks().forEach((t) => t.stop());
      setScreen(null);
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast("Screen sharing is not supported on this device", "error");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      // The browser's own "Stop sharing" button ends the track.
      s.getVideoTracks()[0].addEventListener("ended", () => setScreen(null));
      setScreen(s);
    } catch {
      // The user closed the picker.
    }
  }, [screen, toast]);

  const react = (emoji: string) => setReaction({ emoji, id: Date.now() });

  const toggleHand = async () => {
    if (!me) return;
    const next = !me.is_hand_raised;
    patchMe({ is_hand_raised: next });
    await api.updateSelf(pid, { is_hand_raised: next }).catch(() => {});
  };

  const leave = async () => {
    await api.leave(pid).catch(() => {});
    stopAll();
    screen?.getTracks().forEach((t) => t.stop());
    clearMeetingSession(code);
    router.push("/");
  };

  const endForAll = async () => {
    try {
      await api.endMeeting(code, pid);
      stopAll();
      clearMeetingSession(code);
      router.push("/");
      toast("Meeting ended for all participants", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const muteAll = async () => {
    try {
      const { muted } = await api.muteAll(code, pid);
      toast(muted ? `Muted ${muted} participant${muted > 1 ? "s" : ""}` : "Everyone is already muted", "success");
      room.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const muteOne = async (p: Participant) => {
    try {
      await api.muteParticipant(p.id, pid);
      room.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const removeOne = async (p: Participant) => {
    if (!window.confirm(`Remove ${p.display_name} from the meeting?`)) return;
    try {
      await api.removeParticipant(p.id, pid);
      toast(`${p.display_name} was removed`, "success");
      room.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const sendMessage = async (text: string) => {
    try {
      const msg = await api.sendMessage(code, pid, text);
      room.addLocalMessage(msg);
    } catch (e) {
      toast((e as Error).message, "error");
      throw e;
    }
  };

  if (endReason) return <RoomEndScreen reason={endReason} code={code} />;
  if (!meeting || !me) return <Loading />;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-room-bg text-white">
      {/* Top bar */}
      <div className="relative flex h-10 shrink-0 items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInfoOpen((o) => !o)}
            className="rounded p-1.5 hover:bg-room-hover"
            aria-label="Meeting information"
          >
            <ShieldCheck className="h-5 w-5 text-zoom-green" />
          </button>
          {meeting.started_at && now && (
            <span className="text-xs tabular-nums text-[#B3B3B3]">{elapsed(meeting.started_at, now)}</span>
          )}
        </div>
        <p className="absolute left-1/2 hidden max-w-[40%] -translate-x-1/2 truncate text-xs font-semibold text-[#D0D0D0] sm:block">
          {meeting.title}
        </p>
        <div className="relative">
          <button
            onClick={() => setViewMenu((o) => !o)}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold hover:bg-room-hover"
          >
            {view === "gallery" ? <LayoutGrid className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
            View
          </button>
          {viewMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setViewMenu(false)} />
              <div className="absolute right-0 top-9 z-40 w-40 animate-fade-up rounded-lg bg-[#2B2B2B] py-1 text-sm shadow-pop">
                {(["speaker", "gallery"] as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setView(v);
                      setViewMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10"
                  >
                    <span className="w-3">{view === v ? "✓" : ""}</span>
                    {v === "speaker" ? "Speaker" : "Gallery"}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {infoOpen && <MeetingInfo meeting={meeting} myName={me.display_name} onClose={() => setInfoOpen(false)} />}
      </div>

      {screen && (
        <div className="flex shrink-0 items-center justify-center gap-3 bg-zoom-green/90 py-1 text-xs font-semibold text-white">
          You are screen sharing
          <button onClick={toggleShare} className="rounded bg-zoom-red px-2 py-0.5 hover:bg-zoom-red-hover">Stop Share</button>
        </div>
      )}
      {room.connectionLost && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-500 py-1 text-xs font-semibold text-zoom-ink">
          <WifiOff className="h-3.5 w-3.5" /> Connection lost. Reconnecting...
        </div>
      )}
      {media.error && !room.connectionLost && (
        <div className="shrink-0 bg-[#2B2B2B] py-1 text-center text-xs text-[#D0D0D0]">{media.error}</div>
      )}

      {/* Video area and side panel */}
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <MeetingStage
            participants={people}
            meId={pid}
            myStream={media.stream}
            speaking={media.speaking}
            reaction={reaction}
            view={view}
            screen={screen}
          />
        </div>
        {panel === "participants" && (
          <ParticipantsPanel
            participants={people}
            meId={pid}
            isHost={isHost}
            onClose={() => setPanel(null)}
            onInvite={() => copy(invitationText(meeting), "Invitation")}
            onMuteAll={muteAll}
            onMute={muteOne}
            onRemove={removeOne}
          />
        )}
        {panel === "chat" && (
          <ChatPanel messages={messages} meId={pid} onSend={sendMessage} onClose={() => setPanel(null)} />
        )}
      </div>

      <ControlBar
        audioOn={media.audioOn}
        videoOn={media.videoOn}
        isHost={isHost}
        participantCount={people.length}
        unreadChat={unread}
        sharing={!!screen}
        activePanel={panel}
        handRaised={me.is_hand_raised}
        onToggleAudio={() => media.toggleAudio()}
        onToggleVideo={() => media.toggleVideo()}
        onTogglePanel={(p) => setPanel((cur) => (cur === p ? null : p))}
        onToggleShare={toggleShare}
        onReact={react}
        onToggleHand={toggleHand}
        onLeave={leave}
        onEndForAll={endForAll}
      />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-room-bg text-white">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-[#B3B3B3]">Joining meeting...</p>
    </div>
  );
}
