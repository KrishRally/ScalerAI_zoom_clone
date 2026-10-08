"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LayoutGrid, Lock, ShieldCheck, User as UserIcon, WifiOff } from "lucide-react";
import AssignHostModal from "@/components/room/AssignHostModal";
import ChatPanel from "@/components/room/ChatPanel";
import ControlBar, { type Panel } from "@/components/room/ControlBar";
import HostToolsPanel from "@/components/room/HostToolsPanel";
import MeetingInfo from "@/components/room/MeetingInfo";
import MeetingStage, { type ViewMode } from "@/components/room/MeetingStage";
import NotesPanel from "@/components/room/NotesPanel";
import ParticipantsPanel from "@/components/room/ParticipantsPanel";
import RenameModal from "@/components/room/RenameModal";
import RoomEndScreen from "@/components/room/RoomEndScreen";
import WaitingRoomScreen from "@/components/room/WaitingRoomScreen";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useCopy } from "@/hooks/useCopy";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useMeetingRoom, type MeetingRoom } from "@/hooks/useMeetingRoom";
import { useNow } from "@/hooks/useNow";
import { api } from "@/lib/api";
import { elapsed, invitationText } from "@/lib/format";
import { clearMeetingSession, loadMeetingSession, type MeetingSession } from "@/lib/session";
import type { MeetingSettings, Participant } from "@/lib/types";

export default function MeetingPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [session, setSession] = useState<MeetingSession | null>(null);

  // This tab must have joined through the preview window first.
  useEffect(() => {
    const saved = loadMeetingSession(code);
    if (saved) setSession(saved);
    else router.replace(`/j/${code}`);
  }, [code, router]);

  if (!session) return <Loading />;
  return <Room code={code} session={session} />;
}

/** Decides what to show: loading, the waiting room, the meeting, or the "meeting over" screen. */
function Room({ code, session }: { code: string; session: MeetingSession }) {
  const router = useRouter();
  const room = useMeetingRoom(code, session.participantId);
  const { meeting, me, endReason } = room;

  useEffect(() => {
    if (endReason) clearMeetingSession(code);
  }, [endReason, code]);

  // Leaving the room page any other way (the browser's Back button, a link)
  // counts as leaving the meeting, so we don't stay behind as a "ghost".
  // We check the address because in development React mounts components twice
  // without actually navigating.
  useEffect(() => {
    const roomPath = window.location.pathname;
    return () => {
      if (window.location.pathname !== roomPath) {
        api.leaveInBackground(session.participantId);
        clearMeetingSession(code);
      }
    };
  }, [code, session.participantId]);

  useEffect(() => {
    if (meeting) document.title = `${meeting.title} - Zoom`;
  }, [meeting]);

  if (endReason) return <RoomEndScreen reason={endReason} code={code} />;
  if (!meeting || !me) return <Loading />;

  if (me.status === "waiting") {
    const leave = async () => {
      await api.leave(session.participantId).catch(() => {});
      clearMeetingSession(code);
      router.push("/");
    };
    return <WaitingRoomScreen meeting={meeting} onLeave={leave} />;
  }

  // The camera only starts once we are actually let into the meeting.
  return <InMeeting code={code} session={session} room={room} />;
}

function InMeeting({ code, session, room }: { code: string; session: MeetingSession; room: MeetingRoom }) {
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const now = useNow(1000);
  const pid = session.participantId;

  const media = useLocalMedia({ audio: !session.startMuted, video: session.startVideoOn });
  const meeting = room.meeting!;
  const me = room.me!;
  const { participants, waiting, messages, patchMe } = room;
  const settings = meeting.settings;
  const isHost = me.role === "host";

  const [panel, setPanel] = useState<Panel | null>(null);
  const [view, setView] = useState<ViewMode>("gallery");
  const [viewMenu, setViewMenu] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [renaming, setRenaming] = useState<Participant | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  // What the host's rules block for us. The host is never blocked.
  const blocked = {
    unmute: !isHost && !settings.allow_unmute,
    video: !isHost && !settings.allow_video,
    share: !isHost && !settings.allow_screen_share,
    reactions: !isHost && !settings.allow_reactions,
    chat: !isHost && !settings.allow_chat,
    rename: !isHost && !settings.allow_rename,
  };

  // ---- Keep the server in step with our mic and camera ----
  const lastLocalChange = useRef(0);
  useEffect(() => {
    lastLocalChange.current = Date.now();
    patchMe({ is_muted: !media.audioOn, is_video_on: media.videoOn });
    api.updateSelf(pid, { is_muted: !media.audioOn, is_video_on: media.videoOn }).catch(() => {});
  }, [media.audioOn, media.videoOn, pid, patchMe]);

  // If the host muted us or stopped our video, the server disagrees with our devices.
  // Ignore this for a few seconds after our own change, in case the poll was out of date.
  // `me` is a new object on every poll, so this re-checks every 2 seconds.
  const { audioOn, videoOn, toggleAudio, toggleVideo, stopAll } = media;
  useEffect(() => {
    if (Date.now() - lastLocalChange.current < 4000) return;
    if (me.is_muted && audioOn) {
      toggleAudio(false);
      toast("The host has muted you", "info");
    }
    if (!me.is_video_on && videoOn) {
      toggleVideo(false);
      toast("The host has stopped your video", "info");
    }
  }, [me, audioOn, videoOn, toggleAudio, toggleVideo, toast]);

  // Tell people when they become host.
  const lastRole = useRef(me.role);
  useEffect(() => {
    if (lastRole.current !== "host" && me.role === "host") toast("You are now the host", "success");
    lastRole.current = me.role;
  }, [me.role, toast]);

  // Tell the host when someone enters the waiting room.
  const knownWaiting = useRef(new Set<number>());
  useEffect(() => {
    for (const p of waiting) {
      if (!knownWaiting.current.has(p.id)) toast(`${p.display_name} entered the waiting room`, "info");
    }
    knownWaiting.current = new Set(waiting.map((p) => p.id));
  }, [waiting, toast]);

  // Stop screen sharing if the host turns it off, or if we navigate away.
  const screenRef = useRef<MediaStream | null>(null);
  screenRef.current = screen;
  const stopShare = useCallback(() => {
    screenRef.current?.getTracks().forEach((t) => t.stop());
    setScreen(null);
  }, []);
  useEffect(() => {
    if (blocked.share && screenRef.current) {
      stopShare();
      toast("The host has disabled screen sharing", "info");
    }
  }, [blocked.share, stopShare, toast]);
  useEffect(() => () => screenRef.current?.getTracks().forEach((t) => t.stop()), []);

  // Close the host panel if we stop being host.
  useEffect(() => {
    if (!isHost && panel === "host") setPanel(null);
  }, [isHost, panel]);

  // ---- Unread chat badge ----
  const seenMessages = useRef<number | null>(null);
  if (seenMessages.current === null) seenMessages.current = messages.length; // history is not "unread"
  useEffect(() => {
    if (panel === "chat") seenMessages.current = messages.length;
  }, [panel, messages.length]);
  const unread = panel === "chat" ? 0 : Math.max(0, messages.length - (seenMessages.current ?? 0));

  // Our own tile uses the live device state so it never lags behind the server.
  const people: Participant[] = useMemo(
    () => participants.map((p) => (p.id === pid ? { ...p, is_muted: !audioOn, is_video_on: videoOn } : p)),
    [participants, pid, audioOn, videoOn],
  );
  const others = people.filter((p) => p.id !== pid);

  // ---- Actions ----
  const fail = (e: unknown) => toast((e as Error).message, "error");

  const onToggleAudio = () => {
    if (!audioOn && blocked.unmute) return toast("The host has disabled unmuting", "info");
    toggleAudio();
  };

  const onToggleVideo = () => {
    if (!videoOn && blocked.video) return toast("The host has disabled starting video", "info");
    toggleVideo();
  };

  const toggleShare = async () => {
    if (screen) return stopShare();
    if (blocked.share) return toast("The host has disabled screen sharing", "info");
    if (!navigator.mediaDevices?.getDisplayMedia) return toast("Screen sharing is not supported on this device", "error");
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      // The browser's own "Stop sharing" button ends the track.
      s.getVideoTracks()[0].addEventListener("ended", () => setScreen(null));
      setScreen(s);
    } catch {
      // The user closed the picker.
    }
  };

  const react = async (emoji: string) => {
    try {
      // Show it right away; the poll knows this id already and won't replay it.
      room.showReaction(await api.sendReaction(code, pid, emoji));
    } catch (e) {
      fail(e);
    }
  };

  const toggleHand = async () => {
    const next = !me.is_hand_raised;
    patchMe({ is_hand_raised: next });
    await api.updateSelf(pid, { is_hand_raised: next }).catch(fail);
  };

  const exitMeeting = () => {
    stopAll();
    stopShare();
    clearMeetingSession(code);
    router.push("/");
  };

  const leave = async () => {
    // Zoom asks the host to hand over before leaving.
    if (isHost && others.length > 0) return setAssignOpen(true);
    await api.leave(pid).catch(() => {});
    exitMeeting();
  };

  const assignAndLeave = async (p: Participant) => {
    try {
      await api.makeHost(p.id, pid);
      await api.leave(pid).catch(() => {});
      exitMeeting();
    } catch (e) {
      fail(e);
    }
  };

  const endForAll = async () => {
    try {
      await api.endMeeting(code, pid);
      exitMeeting();
      toast("Meeting ended for all participants", "success");
    } catch (e) {
      fail(e);
    }
  };

  const hostAction = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action();
      if (success) toast(success, "success");
      room.refresh();
    } catch (e) {
      fail(e);
    }
  };

  const muteAll = () =>
    hostAction(async () => {
      const { muted } = await api.muteAll(code, pid);
      toast(muted ? `Muted ${muted} participant${muted > 1 ? "s" : ""}` : "Everyone is already muted", "success");
    });

  const removeOne = (p: Participant) => {
    if (!window.confirm(`Remove ${p.display_name} from the meeting?`)) return;
    hostAction(() => api.removeParticipant(p.id, pid), `${p.display_name} was removed`);
  };

  const makeHost = (p: Participant) => {
    if (!window.confirm(`Make ${p.display_name} the host? You will lose host controls.`)) return;
    hostAction(() => api.makeHost(p.id, pid), `${p.display_name} is now the host`);
  };

  const rename = async (name: string) => {
    if (!renaming) return;
    try {
      if (renaming.id === pid) {
        await api.updateSelf(pid, { display_name: name });
        patchMe({ display_name: name });
      } else {
        await api.renameParticipant(renaming.id, pid, name);
      }
      room.refresh();
    } catch (e) {
      fail(e);
      throw e;
    }
  };

  const changeSettings = async (changes: Partial<MeetingSettings>) => {
    try {
      room.patchSettings(await api.updateSettings(code, pid, changes));
    } catch (e) {
      fail(e);
    }
  };

  const suspend = async () => {
    try {
      room.patchSettings(await api.suspend(code, pid));
      toast("Participant activities suspended. The meeting is locked.", "success");
      room.refresh();
    } catch (e) {
      fail(e);
    }
  };

  const sendMessage = async (text: string) => {
    try {
      room.addLocalMessage(await api.sendMessage(code, pid, text));
    } catch (e) {
      fail(e);
      throw e;
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-room-bg text-white">
      {/* Top bar */}
      <div className="relative flex h-10 shrink-0 items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setInfoOpen((o) => !o)} className="rounded p-1.5 hover:bg-room-hover" aria-label="Meeting information">
            <ShieldCheck className="h-5 w-5 text-zoom-green" />
          </button>
          {meeting.started_at && now && (
            <span className="text-xs tabular-nums text-[#B3B3B3]">{elapsed(meeting.started_at, now)}</span>
          )}
          {settings.is_locked && (
            <span className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#D0D0D0]">
              <Lock className="h-3 w-3" /> Locked
            </span>
          )}
        </div>
        <p className="absolute left-1/2 hidden max-w-[40%] -translate-x-1/2 truncate text-xs font-semibold text-[#D0D0D0] sm:block">
          {meeting.title}
        </p>
        <div className="relative">
          <button onClick={() => setViewMenu((o) => !o)} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold hover:bg-room-hover">
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
          <button onClick={stopShare} className="rounded bg-zoom-red px-2 py-0.5 hover:bg-zoom-red-hover">Stop Share</button>
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
            reactions={room.reactions}
            view={view}
            screen={screen}
          />
        </div>
        {panel === "participants" && (
          <ParticipantsPanel
            participants={people}
            waiting={waiting}
            meId={pid}
            isHost={isHost}
            canRenameSelf={!blocked.rename}
            onClose={() => setPanel(null)}
            onInvite={() => copy(invitationText(meeting), "Invitation")}
            onMuteAll={muteAll}
            onMute={(p) => hostAction(() => api.muteParticipant(p.id, pid))}
            onRemove={removeOne}
            onRename={setRenaming}
            onMakeHost={makeHost}
            onAdmit={(p) => hostAction(() => api.admit(p.id, pid), `${p.display_name} was admitted`)}
            onAdmitAll={() => hostAction(() => api.admitAll(code, pid), "Everyone in the waiting room was admitted")}
          />
        )}
        {panel === "chat" && (
          <ChatPanel messages={messages} meId={pid} onSend={sendMessage} onClose={() => setPanel(null)} disabled={blocked.chat} />
        )}
        {panel === "notes" && <NotesPanel code={code} participantId={pid} onClose={() => setPanel(null)} />}
        {panel === "host" && isHost && (
          <HostToolsPanel settings={settings} onChange={changeSettings} onSuspend={suspend} onClose={() => setPanel(null)} />
        )}
      </div>

      <ControlBar
        audioOn={audioOn}
        videoOn={videoOn}
        isHost={isHost}
        participantCount={people.length}
        waitingCount={isHost ? waiting.length : 0}
        unreadChat={unread}
        sharing={!!screen}
        activePanel={panel}
        handRaised={me.is_hand_raised}
        blocked={blocked}
        mics={media.mics}
        cams={media.cams}
        micId={media.micId}
        camId={media.camId}
        onSelectMic={media.selectMic}
        onSelectCam={media.selectCam}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onTogglePanel={(p) => setPanel((cur) => (cur === p ? null : p))}
        onToggleShare={toggleShare}
        onReact={react}
        onToggleHand={toggleHand}
        onShowInfo={() => setInfoOpen(true)}
        onLeave={leave}
        onEndForAll={endForAll}
      />

      <RenameModal participant={renaming} isSelf={renaming?.id === pid} onClose={() => setRenaming(null)} onSave={rename} />
      <AssignHostModal open={assignOpen} candidates={others} onClose={() => setAssignOpen(false)} onAssign={assignAndLeave} />
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
