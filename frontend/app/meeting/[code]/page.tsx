"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AssignHostModal from "@/components/room/AssignHostModal";
import ChatPanel from "@/components/room/ChatPanel";
import ControlBar, { type Panel } from "@/components/room/ControlBar";
import HostToolsPanel from "@/components/room/HostToolsPanel";
import MeetingStage, { type ViewMode } from "@/components/room/MeetingStage";
import NotesPanel from "@/components/room/NotesPanel";
import ParticipantsPanel from "@/components/room/ParticipantsPanel";
import RemoteAudio, { resumeRemoteAudio } from "@/components/room/RemoteAudio";
import RenameModal from "@/components/room/RenameModal";
import RoomBanners from "@/components/room/RoomBanners";
import RoomEndScreen from "@/components/room/RoomEndScreen";
import RoomTopBar from "@/components/room/RoomTopBar";
import WaitingRoomScreen from "@/components/room/WaitingRoomScreen";
import SharePicker from "@/components/share/SharePicker";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useCopy } from "@/hooks/useCopy";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useMeetingRoom, type MeetingRoom } from "@/hooks/useMeetingRoom";
import { useHostActions } from "@/hooks/room/useHostActions";
import { useMediaSync } from "@/hooks/room/useMediaSync";
import { useMeetingCall } from "@/hooks/room/useMeetingCall";
import { useRoomNotices } from "@/hooks/room/useRoomNotices";
import { useScreenShare } from "@/hooks/room/useScreenShare";
import { useUnreadCount } from "@/hooks/room/useUnreadCount";
import { api } from "@/lib/api";
import { invitationText } from "@/lib/format";
import { clearMeetingSession, loadMeetingSession, type MeetingSession } from "@/lib/session";
import { clearPendingShare } from "@/lib/shareScreen";
import type { Participant } from "@/lib/types";

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
    if (!endReason) return;
    clearMeetingSession(code);
    clearPendingShare(); // a screen picked on the Home page that never got shared
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
        clearPendingShare();
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
      clearPendingShare();
      router.push("/");
    };
    return <WaitingRoomScreen meeting={meeting} onLeave={leave} />;
  }

  // The camera only starts once we are actually let into the meeting.
  return <InMeeting code={code} session={session} room={room} />;
}

/** The meeting itself: the stage, side panels, toolbar and dialogs. The logic lives in the hooks under hooks/room. */
function InMeeting({ code, session, room }: { code: string; session: MeetingSession; room: MeetingRoom }) {
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const pid = session.participantId;

  const media = useLocalMedia({ audio: !session.startMuted, video: session.startVideoOn });
  const meeting = room.meeting!;
  const me = room.me!;
  const { participants, waiting, messages, patchMe } = room;
  const settings = meeting.settings;
  const isHost = me.role === "host";

  const [panel, setPanel] = useState<Panel | null>(null);
  const [view, setView] = useState<ViewMode>("gallery");
  const [infoOpen, setInfoOpen] = useState(false);
  const [renaming, setRenaming] = useState<Participant | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  // What the host's rules block for us. The host is never blocked.
  const blocked = {
    unmute: !isHost && !settings.allow_unmute,
    video: !isHost && !settings.allow_video,
    share: !isHost && !settings.allow_screen_share,
    reactions: !isHost && !settings.allow_reactions,
    chat: !isHost && !settings.allow_chat,
    rename: !isHost && !settings.allow_rename,
  };

  useMediaSync(pid, media, me, patchMe);
  useRoomNotices(me, waiting);
  const share = useScreenShare({ code, pid, me, participants, blocked: blocked.share });
  const unread = useUnreadCount(messages.length, panel === "chat");

  // Close the host panel if we stop being host.
  useEffect(() => {
    if (!isHost && panel === "host") setPanel(null);
  }, [isHost, panel]);

  // Our own tile uses the live device state so it never lags behind the server.
  const { audioOn, videoOn, toggleAudio, toggleVideo, stopAll } = media;
  const people: Participant[] = useMemo(
    () =>
      participants.map((p) =>
        p.id === pid
          ? { ...p, is_muted: !audioOn, is_video_on: videoOn, is_sharing_screen: !!share.screen, share_with_video: !!share.screen && share.shareWithVideo }
          : p,
      ),
    [participants, pid, audioOn, videoOn, share.screen, share.shareWithVideo],
  );
  const others = people.filter((p) => p.id !== pid);
  const call = useMeetingCall(pid, others, media.stream, share.screen, media.speaking);

  // ---- Leaving ----
  const exitMeeting = () => {
    stopAll();
    share.stopShare();
    clearMeetingSession(code);
    router.push("/");
  };
  const host = useHostActions(code, pid, room, exitMeeting);

  // ---- Our own actions ----
  const fail = (e: unknown) => toast((e as Error).message, "error");

  const onToggleAudio = () => {
    if (!audioOn && blocked.unmute) return toast("The host has disabled unmuting", "info");
    toggleAudio();
  };

  const onToggleVideo = () => {
    if (!videoOn && blocked.video) return toast("The host has disabled starting video", "info");
    toggleVideo();
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

  /** Rename yourself, or (host) someone else. */
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

  const sendMessage = async (text: string) => {
    try {
      room.addLocalMessage(await api.sendMessage(code, pid, text));
    } catch (e) {
      fail(e);
      throw e;
    }
  };

  const invite = () => copy(invitationText(meeting), "Invitation");

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-room-bg text-white">
      <RoomTopBar
        meeting={meeting}
        myName={me.display_name}
        notesOpen={panel === "notes"}
        onToggleNotes={() => togglePanel("notes")}
        view={view}
        onViewChange={setView}
        infoOpen={infoOpen}
        onInfoOpenChange={setInfoOpen}
      />
      <RoomBanners
        sharing={!!share.screen}
        onStopShare={share.stopShare}
        connectionLost={room.connectionLost}
        callStuck={call.stuck}
        audioBlocked={call.audioBlocked}
        onResumeAudio={() => {
          resumeRemoteAudio();
          call.clearAudioBlocked();
        }}
        mediaError={media.error}
      />

      {/* Video area and side panel */}
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <MeetingStage
            participants={people}
            meId={pid}
            myStream={media.stream}
            remote={call.remote}
            speaking={call.speaking}
            reactions={room.reactions}
            view={view}
            screen={share.screen}
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
            onInvite={invite}
            onMuteAll={host.muteAll}
            onMute={host.mute}
            onRemove={host.remove}
            onRename={setRenaming}
            onMakeHost={host.makeHost}
            onAdmit={host.admit}
            onAdmitAll={host.admitAll}
          />
        )}
        {panel === "chat" && (
          <ChatPanel messages={messages} meId={pid} onSend={sendMessage} onClose={() => setPanel(null)} disabled={blocked.chat} />
        )}
        {panel === "notes" && <NotesPanel code={code} participantId={pid} onClose={() => setPanel(null)} />}
        {panel === "host" && isHost && (
          <HostToolsPanel settings={settings} onChange={host.changeSettings} onSuspend={host.suspend} onClose={() => setPanel(null)} />
        )}
      </div>

      <ControlBar
        audioOn={audioOn}
        videoOn={videoOn}
        isHost={isHost}
        participantCount={people.length}
        waitingCount={isHost ? waiting.length : 0}
        unreadChat={unread}
        sharing={!!share.screen}
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
        onTogglePanel={togglePanel}
        onToggleShare={share.toggleShare}
        onReact={react}
        onToggleHand={toggleHand}
        onInvite={invite}
        onShowInfo={() => setInfoOpen(true)}
        onLeave={leave}
        onEndForAll={host.endForAll}
      />

      {/* Everyone else's voices */}
      {others.map((p) => {
        const { audio, screenAudio } = call.remote[p.id] ?? {};
        return (
          <span key={p.id} hidden>
            {audio && <RemoteAudio stream={audio} onBlocked={call.onAudioBlocked} />}
            {/* Their computer's sound, when they share with "Share sound" */}
            {screenAudio && p.is_sharing_screen && <RemoteAudio stream={screenAudio} onBlocked={call.onAudioBlocked} />}
          </span>
        );
      })}

      <SharePicker
        open={share.pickerOpen}
        onClose={() => share.setPickerOpen(false)}
        onShare={async (s, withVideo) => {
          await share.startShare(s, withVideo);
          share.setPickerOpen(false);
        }}
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
