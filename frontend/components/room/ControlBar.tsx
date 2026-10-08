"use client";

import { useState } from "react";
import {
  Check,
  ChevronUp,
  CircleEllipsis,
  CircleX,
  Heart,
  Info,
  MessageSquare,
  Mic,
  MicOff,
  NotebookPen,
  ShieldPlus,
  SquareArrowUp,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DeviceOption } from "@/hooks/useLocalMedia";

export type Panel = "participants" | "chat" | "notes" | "host";
type Menu = "reactions" | "end" | "more" | "mic" | "cam" | "people" | "chat" | "share";

interface Props {
  audioOn: boolean;
  videoOn: boolean;
  isHost: boolean;
  participantCount: number;
  waitingCount: number;
  unreadChat: number;
  sharing: boolean;
  activePanel: Panel | null;
  handRaised: boolean;
  /** Which buttons the host's rules block for this person (always all false for the host). */
  blocked: { unmute: boolean; video: boolean; share: boolean; reactions: boolean };
  mics: DeviceOption[];
  cams: DeviceOption[];
  micId?: string;
  camId?: string;
  onSelectMic: (id: string) => void;
  onSelectCam: (id: string) => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onTogglePanel: (panel: Panel) => void;
  onToggleShare: () => void;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
  onInvite: () => void;
  onShowInfo: () => void;
  onLeave: () => void;
  onEndForAll: () => void;
}

const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"];

/** The black toolbar along the bottom of the meeting, laid out like the Zoom app. */
export default function ControlBar(props: Props) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const toggleMenu = (m: Menu) => setMenu((cur) => (cur === m ? null : m));
  const close = () => setMenu(null);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <footer className="relative z-20 flex h-[76px] shrink-0 items-center justify-between gap-1 bg-[#131313] px-1 sm:px-5">
      {menu && <div className="fixed inset-0 z-10" onClick={close} />}

      {/* Left: audio and video, each with a device menu on the arrow */}
      <div className="flex items-center gap-1 sm:gap-3">
        <Group>
          <ToolButton
            icon={props.audioOn ? Mic : MicOff}
            label="Audio"
            ariaLabel={props.audioOn ? "Mute" : "Unmute"}
            danger={!props.audioOn}
            dimmed={!props.audioOn && props.blocked.unmute}
            onClick={props.onToggleAudio}
          />
          <CaretButton label="Audio settings" onClick={() => toggleMenu("mic")} />
          {menu === "mic" && (
            <DeviceMenu title="Select a microphone" devices={props.mics} selected={props.micId} onPick={(id) => { close(); props.onSelectMic(id); }} />
          )}
        </Group>
        <Group>
          <ToolButton
            icon={props.videoOn ? Video : VideoOff}
            label="Video"
            ariaLabel={props.videoOn ? "Stop Video" : "Start Video"}
            danger={!props.videoOn}
            dimmed={!props.videoOn && props.blocked.video}
            onClick={props.onToggleVideo}
          />
          <CaretButton label="Video settings" onClick={() => toggleMenu("cam")} />
          {menu === "cam" && (
            <DeviceMenu title="Select a camera" devices={props.cams} selected={props.camId} onPick={(id) => { close(); props.onSelectCam(id); }} />
          )}
        </Group>
      </div>

      {/* Middle */}
      <div className="flex min-w-0 items-center gap-0 sm:gap-2">
        <Group>
          <ToolButton
            icon={Users}
            label="Participants"
            ariaLabel={`Participants ${props.participantCount}`}
            active={props.activePanel === "participants"}
            onClick={() => props.onTogglePanel("participants")}
            count={
              <span className="flex items-center gap-1 text-[13px]">
                {props.participantCount}
                {props.waitingCount > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-zoom-ink" title="Waiting room">{props.waitingCount}</span>
                )}
              </span>
            }
          />
          <CaretButton label="Participant options" onClick={() => toggleMenu("people")} />
          {menu === "people" && (
            <Popover className="left-1/2 w-56 -translate-x-1/2 p-1.5">
              <MenuRow onClick={run(props.onInvite)}>Invite</MenuRow>
              <MenuRow onClick={run(() => props.onTogglePanel("participants"))}>Manage participants</MenuRow>
            </Popover>
          )}
        </Group>
        <Group>
          <ToolButton
            icon={MessageSquare}
            label="Chat"
            active={props.activePanel === "chat"}
            onClick={() => props.onTogglePanel("chat")}
            count={
              props.unreadChat > 0 ? (
                <span className="min-w-4 rounded-full bg-zoom-red px-1 text-center text-[10px] font-bold">{props.unreadChat > 9 ? "9+" : props.unreadChat}</span>
              ) : null
            }
          />
          <CaretButton label="Chat options" onClick={() => toggleMenu("chat")} />
          {menu === "chat" && (
            <Popover className="left-1/2 w-48 -translate-x-1/2 p-1.5">
              <MenuRow onClick={run(() => props.onTogglePanel("chat"))}>Open chat</MenuRow>
            </Popover>
          )}
        </Group>
        <Group>
          <ToolButton
            icon={Heart}
            label="React"
            active={menu === "reactions"}
            dimmed={props.blocked.reactions}
            onClick={() => toggleMenu("reactions")}
          />
          <CaretButton label="Emoji options" onClick={() => toggleMenu("reactions")} />
          {menu === "reactions" && (
            <Popover className="left-1/2 w-64 -translate-x-1/2">
              {props.blocked.reactions ? (
                <p className="px-1 pb-2 text-center text-xs text-[#B3B3B3]">The host has disabled reactions</p>
              ) : (
                <div className="flex justify-between">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={run(() => props.onReact(emoji))}
                      className="rounded-lg p-1.5 text-2xl transition-transform hover:scale-125 hover:bg-white/10"
                      aria-label={`React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={run(props.onToggleHand)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                ✋ {props.handRaised ? "Lower Hand" : "Raise Hand"}
              </button>
            </Popover>
          )}
        </Group>
        <Group className="hidden sm:flex">
          <ToolButton
            icon={SquareArrowUp}
            label={props.sharing ? "Stop Share" : "Share"}
            danger={props.sharing}
            onClick={props.onToggleShare}
            dimmed={!props.sharing && props.blocked.share}
          />
          <CaretButton label="Share options" onClick={() => toggleMenu("share")} />
          {menu === "share" && (
            <Popover className="left-1/2 w-52 -translate-x-1/2 p-1.5">
              <MenuRow onClick={run(props.onToggleShare)}>{props.sharing ? "Stop sharing" : "Share screen..."}</MenuRow>
            </Popover>
          )}
        </Group>
        {props.isHost && (
          <ToolButton
            icon={ShieldPlus}
            label="Host tools"
            active={props.activePanel === "host"}
            onClick={() => props.onTogglePanel("host")}
            className="hidden sm:flex"
          />
        )}
        <div className="relative z-20">
          <ToolButton icon={CircleEllipsis} label="More" active={menu === "more"} onClick={() => toggleMenu("more")} />
          {menu === "more" && (
            <Popover className="right-0 w-max max-w-[16rem] p-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
              <div className="flex flex-wrap justify-center gap-1">
                {/* On small screens some toolbar buttons move in here */}
                <MoreItem icon={SquareArrowUp} label={props.sharing ? "Stop Share" : "Share"} className="sm:hidden" onClick={run(props.onToggleShare)} />
                {props.isHost && <MoreItem icon={ShieldPlus} label="Host tools" className="sm:hidden" onClick={run(() => props.onTogglePanel("host"))} />}
                <MoreItem icon={NotebookPen} label="Notes" onClick={run(() => props.onTogglePanel("notes"))} />
                <MoreItem icon={Info} label="Meeting info" onClick={run(props.onShowInfo)} />
              </div>
            </Popover>
          )}
        </div>
      </div>

      {/* Right: leave or end, a red circle with an X like Zoom */}
      <div className="relative z-20">
        <button
          onClick={() => toggleMenu("end")}
          className="flex min-w-[52px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-white hover:bg-room-hover sm:min-w-[64px]"
        >
          <CircleX className="h-6 w-6 text-[#FF3B30]" strokeWidth={2} />
          <span className="text-[12px] sm:text-[13px]">{props.isHost ? "End" : "Leave"}</span>
        </button>
        {menu === "end" && (
          <div className="absolute bottom-[60px] right-0 w-60 animate-fade-up space-y-2 rounded-xl bg-[#2B2B2B] p-3 shadow-pop">
            {props.isHost && (
              <button onClick={run(props.onEndForAll)} className="w-full rounded-lg bg-zoom-red py-2 text-sm font-bold text-white hover:bg-zoom-red-hover">
                End meeting for all
              </button>
            )}
            <button onClick={run(props.onLeave)} className="w-full rounded-lg bg-white/10 py-2 text-sm font-bold text-white hover:bg-white/20">
              Leave meeting
            </button>
          </div>
        )}
      </div>
    </footer>
  );
}

/** A button and its small ^ arrow, sitting together. */
function Group({ className = "", children }: { className?: string; children: React.ReactNode }) {
  // "hidden" (when given) wins over "flex" in Tailwind's order, and "sm:flex" brings it back.
  return <div className={`relative z-20 flex items-start ${className}`}>{children}</div>;
}

function Popover({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`absolute bottom-[68px] animate-fade-up rounded-xl bg-[#2B2B2B] p-3 text-white shadow-pop ${className}`}>
      {children}
    </div>
  );
}

function MenuRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white/10">
      {children}
    </button>
  );
}

function DeviceMenu({
  title,
  devices,
  selected,
  onPick,
}: {
  title: string;
  devices: DeviceOption[];
  selected?: string;
  onPick: (id: string) => void;
}) {
  return (
    <Popover className="left-0 w-72 p-2">
      <p className="px-2 pb-1 text-xs font-semibold text-[#B3B3B3]">{title}</p>
      {devices.length === 0 && <p className="px-2 py-1.5 text-sm text-[#8A8A8A]">No devices found</p>}
      {devices.map((d) => (
        <button
          key={d.deviceId}
          onClick={() => onPick(d.deviceId)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10"
        >
          <span className="w-4 shrink-0">{d.deviceId === selected && <Check className="h-4 w-4" />}</span>
          <span className="truncate">{d.label}</span>
        </button>
      ))}
    </Popover>
  );
}

function MoreItem({
  icon: Icon,
  label,
  onClick,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button onClick={onClick} className={`flex w-[76px] flex-col items-center gap-1.5 rounded-lg px-1 py-2.5 text-xs hover:bg-white/10 ${className}`}>
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function CaretButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="-ml-1.5 mt-2 hidden rounded p-1 text-[#BDBDBD] hover:bg-room-hover hover:text-white sm:block"
    >
      <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
}

function ToolButton({
  icon: Icon,
  label,
  ariaLabel,
  onClick,
  danger,
  active,
  dimmed,
  count,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  /** What a screen reader says, when it differs from the visible label (e.g. "Mute" under "Audio"). */
  ariaLabel?: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  /** Greyed out because the host blocked it. Still clickable so we can explain why. */
  dimmed?: boolean;
  /** A number shown next to the icon, like the participant count. */
  count?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`relative flex min-w-[52px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-white hover:bg-room-hover sm:min-w-[64px] sm:px-2 ${
        active ? "bg-room-hover" : ""
      } ${dimmed ? "opacity-40" : ""} ${className}`}
    >
      <span className="flex h-7 items-center gap-1">
        <Icon className={`h-6 w-6 ${danger ? "text-[#FF3B30]" : ""}`} strokeWidth={1.6} />
        {count}
      </span>
      <span className="whitespace-nowrap text-[12px] sm:text-[13px]">{label}</span>
    </button>
  );
}
