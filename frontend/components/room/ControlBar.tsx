"use client";

import { useState } from "react";
import {
  ChevronUp,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Smile,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  audioOn: boolean;
  videoOn: boolean;
  isHost: boolean;
  participantCount: number;
  unreadChat: number;
  sharing: boolean;
  activePanel: "participants" | "chat" | null;
  handRaised: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onTogglePanel: (panel: "participants" | "chat") => void;
  onToggleShare: () => void;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
  onLeave: () => void;
  onEndForAll: () => void;
}

const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"];

/** The black toolbar along the bottom of the meeting. */
export default function ControlBar(props: Props) {
  const [menu, setMenu] = useState<"reactions" | "end" | null>(null);
  const toggleMenu = (m: "reactions" | "end") => setMenu((cur) => (cur === m ? null : m));

  return (
    <footer className="relative z-20 flex h-[68px] shrink-0 items-center justify-between gap-1 bg-room-toolbar px-2 sm:px-4">
      {menu && <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />}

      {/* Left: mic and camera */}
      <div className="flex items-center">
        <ToolButton
          icon={props.audioOn ? Mic : MicOff}
          label={props.audioOn ? "Mute" : "Unmute"}
          danger={!props.audioOn}
          onClick={props.onToggleAudio}
          caret
        />
        <ToolButton
          icon={props.videoOn ? Video : VideoOff}
          label={props.videoOn ? "Stop Video" : "Start Video"}
          danger={!props.videoOn}
          onClick={props.onToggleVideo}
          caret
        />
      </div>

      {/* Middle: the rest */}
      <div className="flex items-center">
        <ToolButton
          icon={Users}
          label="Participants"
          active={props.activePanel === "participants"}
          onClick={() => props.onTogglePanel("participants")}
          badge={<span className="absolute -top-1 left-[calc(50%+6px)] text-[10px] font-bold">{props.participantCount}</span>}
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
        <ToolButton
          icon={MonitorUp}
          label={props.sharing ? "Stop Share" : "Share Screen"}
          onClick={props.onToggleShare}
          iconClass={props.sharing ? "bg-zoom-red text-white" : "bg-zoom-green text-white"}
          className="hidden sm:flex"
        />
        <div className="relative z-20">
          <ToolButton icon={Smile} label="Reactions" active={menu === "reactions"} onClick={() => toggleMenu("reactions")} />
          {menu === "reactions" && (
            <div className="absolute bottom-[64px] left-1/2 w-64 -translate-x-1/2 animate-fade-up rounded-xl bg-[#2B2B2B] p-3 shadow-pop">
              <div className="flex justify-between">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      props.onReact(emoji);
                      setMenu(null);
                    }}
                    className="rounded-lg p-1.5 text-2xl transition-transform hover:scale-125 hover:bg-white/10"
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  props.onToggleHand();
                  setMenu(null);
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                ✋ {props.handRaised ? "Lower Hand" : "Raise Hand"}
              </button>
            </div>
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
              <button onClick={props.onEndForAll} className="w-full rounded-lg bg-zoom-red py-2 text-sm font-bold text-white hover:bg-zoom-red-hover">
                End meeting for all
              </button>
            )}
            <button onClick={props.onLeave} className="w-full rounded-lg bg-white/10 py-2 text-sm font-bold text-white hover:bg-white/20">
              Leave meeting
            </button>
          </div>
        )}
      </div>
    </footer>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  danger,
  active,
  caret,
  badge,
  iconClass,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  caret?: boolean;
  badge?: React.ReactNode;
  iconClass?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex min-w-[56px] flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-[#E6E6E6] hover:bg-room-hover sm:min-w-[76px] sm:px-2 ${
        active ? "bg-room-hover" : ""
      } ${className}`}
    >
      <span className="relative flex items-center">
        <span className={`flex h-6 items-center justify-center rounded-md ${iconClass ? `${iconClass} w-7` : ""}`}>
          <Icon className={`${iconClass ? "h-4 w-4" : "h-5 w-5"} ${danger ? "text-zoom-red" : ""}`} strokeWidth={2} />
        </span>
        {caret && <ChevronUp className="ml-0.5 hidden h-3 w-3 text-[#9A9A9A] sm:block" />}
      </span>
      {badge}
      <span className="whitespace-nowrap text-[10px] sm:text-[11px]">{label}</span>
    </button>
  );
}
