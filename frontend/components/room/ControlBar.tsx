"use client";

import { useState } from "react";
import {
  Check,
  ChevronUp,
  Circle,
  Info,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  NotebookPen,
  PenLine,
  Shield,
  Smile,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DeviceOption } from "@/hooks/useLocalMedia";

export type Panel = "participants" | "chat" | "notes" | "host";
type Menu = "reactions" | "end" | "more" | "mic" | "cam";

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
  onShowInfo: () => void;
  onPlaceholder: (feature: string) => void;
  onLeave: () => void;
  onEndForAll: () => void;
}

const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"];

/** The black toolbar along the bottom of the meeting. */
export default function ControlBar(props: Props) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const toggleMenu = (m: Menu) => setMenu((cur) => (cur === m ? null : m));
  const close = () => setMenu(null);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <footer className="relative z-20 flex h-[68px] shrink-0 items-center justify-between gap-1 bg-room-toolbar px-1 sm:px-4">
      {menu && <div className="fixed inset-0 z-10" onClick={close} />}

      {/* Left: mic and camera, each with a device menu on the arrow */}
      <div className="flex items-center">
        <div className="relative z-20 flex items-center">
          <ToolButton
            icon={props.audioOn ? Mic : MicOff}
            label={props.audioOn ? "Mute" : "Unmute"}
            danger={!props.audioOn}
            dimmed={!props.audioOn && props.blocked.unmute}
            onClick={props.onToggleAudio}
          />
          <CaretButton label="Audio settings" onClick={() => toggleMenu("mic")} />
          {menu === "mic" && (
            <DeviceMenu title="Select a microphone" devices={props.mics} selected={props.micId} onPick={(id) => { close(); props.onSelectMic(id); }} />
          )}
        </div>
        <div className="relative z-20 flex items-center">
          <ToolButton
            icon={props.videoOn ? Video : VideoOff}
            label={props.videoOn ? "Stop Video" : "Start Video"}
            danger={!props.videoOn}
            dimmed={!props.videoOn && props.blocked.video}
            onClick={props.onToggleVideo}
          />
          <CaretButton label="Video settings" onClick={() => toggleMenu("cam")} />
          {menu === "cam" && (
            <DeviceMenu title="Select a camera" devices={props.cams} selected={props.camId} onPick={(id) => { close(); props.onSelectCam(id); }} />
          )}
        </div>
      </div>

      {/* Middle */}
      <div className="flex min-w-0 items-center">
        <ToolButton
          icon={Users}
          label="Participants"
          active={props.activePanel === "participants"}
          onClick={() => props.onTogglePanel("participants")}
          badge={
            <span className="absolute -top-1 left-[calc(50%+6px)] flex items-center gap-0.5 text-[10px] font-bold">
              {props.participantCount}
              {props.waitingCount > 0 && (
                <span className="rounded-full bg-amber-400 px-1 text-zoom-ink" title="Waiting room">{props.waitingCount}</span>
              )}
            </span>
          }
        />
        <ToolButton
          icon={MessageSquare}
          label="Chat"
          active={props.activePanel === "chat"}
          onClick={() => props.onTogglePanel("chat")}
          badge={
            props.unreadChat > 0 ? (
              <span className="absolute -top-1 left-[calc(50%+4px)] min-w-4 rounded-full bg-zoom-red px-1 text-[10px] font-bold">
                {props.unreadChat > 9 ? "9+" : props.unreadChat}
              </span>
            ) : null
          }
        />
        <div className="relative z-20">
          <ToolButton
            icon={Smile}
            label="React"
            active={menu === "reactions"}
            dimmed={props.blocked.reactions}
            onClick={() => toggleMenu("reactions")}
          />
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
        </div>
        <ToolButton
          icon={MonitorUp}
          label={props.sharing ? "Stop Share" : "Share"}
          onClick={props.onToggleShare}
          dimmed={!props.sharing && props.blocked.share}
          iconClass={props.sharing ? "bg-zoom-red text-white" : "bg-zoom-green text-white"}
          className="hidden sm:flex"
        />
        {props.isHost && (
          <ToolButton
            icon={Shield}
            label="Host tools"
            active={props.activePanel === "host"}
            onClick={() => props.onTogglePanel("host")}
            className="hidden sm:flex"
          />
        )}
        <ToolButton
          icon={NotebookPen}
          label="Notes"
          active={props.activePanel === "notes"}
          onClick={() => props.onTogglePanel("notes")}
          className="hidden md:flex"
        />
        <div className="relative z-20">
          <ToolButton icon={MoreHorizontal} label="More" active={menu === "more"} onClick={() => toggleMenu("more")} />
          {menu === "more" && (
            <Popover className="right-0 w-64 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
              <div className="grid grid-cols-3 gap-1">
                {/* On small screens some toolbar buttons move in here */}
                <MoreItem icon={MonitorUp} label="Share" className="sm:hidden" onClick={run(props.onToggleShare)} />
                {props.isHost && <MoreItem icon={Shield} label="Host tools" className="sm:hidden" onClick={run(() => props.onTogglePanel("host"))} />}
                <MoreItem icon={NotebookPen} label="Notes" className="md:hidden" onClick={run(() => props.onTogglePanel("notes"))} />
                <MoreItem icon={Info} label="Meeting info" onClick={run(props.onShowInfo)} />
                <MoreItem icon={Circle} label="Record" onClick={run(() => props.onPlaceholder("Recording"))} />
                <MoreItem icon={PenLine} label="Whiteboards" onClick={run(() => props.onPlaceholder("Whiteboards"))} />
                <MoreItem icon={LayoutGrid} label="Apps" onClick={run(() => props.onPlaceholder("Apps"))} />
              </div>
            </Popover>
          )}
        </div>
      </div>

      {/* Right: leave or end */}
      <div className="relative z-20">
        <button
          onClick={() => toggleMenu("end")}
          className="rounded-lg bg-zoom-red px-3 py-1.5 text-sm font-bold text-white hover:bg-zoom-red-hover sm:px-4"
        >
          {props.isHost ? "End" : "Leave"}
        </button>
        {menu === "end" && (
          <div className="absolute bottom-[52px] right-0 w-60 animate-fade-up space-y-2 rounded-xl bg-[#2B2B2B] p-3 shadow-pop">
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

function Popover({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`absolute bottom-[64px] animate-fade-up rounded-xl bg-[#2B2B2B] p-3 text-white shadow-pop ${className}`}>
      {children}
    </div>
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
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 rounded-lg px-1 py-2.5 text-xs hover:bg-white/10 ${className}`}>
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
      className="-ml-2 hidden self-start rounded p-1 pt-2.5 text-[#9A9A9A] hover:bg-room-hover hover:text-white sm:block"
    >
      <ChevronUp className="h-3 w-3" />
    </button>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  danger,
  active,
  dimmed,
  badge,
  iconClass,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  /** Greyed out because the host blocked it. Still clickable so we can explain why. */
  dimmed?: boolean;
  badge?: React.ReactNode;
  iconClass?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex min-w-[52px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[#E6E6E6] hover:bg-room-hover sm:min-w-[72px] sm:px-2 ${
        active ? "bg-room-hover" : ""
      } ${dimmed ? "opacity-40" : ""} ${className}`}
    >
      <span className={`flex h-6 items-center justify-center rounded-md ${iconClass ? `${iconClass} w-7` : ""}`}>
        <Icon className={`${iconClass ? "h-4 w-4" : "h-5 w-5"} ${danger ? "text-zoom-red" : ""}`} strokeWidth={2} />
      </span>
      {badge}
      <span className="whitespace-nowrap text-[10px] sm:text-[11px]">{label}</span>
    </button>
  );
}
