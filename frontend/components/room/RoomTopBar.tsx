"use client";

import { useState } from "react";
import { Info, LayoutGrid, Lock, NotebookPen, ShieldCheck, User as UserIcon } from "lucide-react";
import MeetingInfo from "./MeetingInfo";
import type { ViewMode } from "./MeetingStage";
import ZoomLogo from "@/components/ui/ZoomLogo";
import { useNow } from "@/hooks/useNow";
import { elapsed } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface Props {
  meeting: Meeting;
  myName: string;
  notesOpen: boolean;
  onToggleNotes: () => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /** Meeting info can also be opened from the toolbar's More menu. */
  infoOpen: boolean;
  onInfoOpenChange: (open: boolean) => void;
}

/** The top of the meeting window, like the Zoom app: logo, title and timer, then security, Notes and View. */
export default function RoomTopBar({ meeting, myName, notesOpen, onToggleNotes, view, onViewChange, infoOpen, onInfoOpenChange }: Props) {
  const now = useNow(1000);
  const [viewMenu, setViewMenu] = useState(false);
  const iconBtn = "rounded p-1.5 hover:bg-room-hover";

  return (
    <div className="relative flex h-12 shrink-0 items-center gap-3 bg-[#1C1C1C] px-3 sm:px-4">
      <ZoomLogo stacked className="hidden text-white sm:inline-flex" />
      <button onClick={() => onInfoOpenChange(!infoOpen)} className="flex min-w-0 items-center gap-2 rounded px-1.5 py-1 text-[15px] hover:bg-room-hover sm:ml-8" aria-label="Meeting information">
        <Info className="h-4 w-4 shrink-0" />
        <span className="truncate">{meeting.title}</span>
      </button>
      {meeting.started_at && now && (
        <span className="shrink-0 text-xs tabular-nums text-[#9A9A9A]">{elapsed(meeting.started_at, now)}</span>
      )}
      {meeting.settings.is_locked && (
        <span className="flex shrink-0 items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#D0D0D0]">
          <Lock className="h-3 w-3" /> Locked
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => onInfoOpenChange(!infoOpen)} className={iconBtn} aria-label="Meeting security" title="This meeting is protected by a passcode">
          <ShieldCheck className="h-5 w-5 text-[#23D959]" />
        </button>
        <button onClick={onToggleNotes} className={`${iconBtn} ${notesOpen ? "bg-room-hover" : ""}`} aria-label="Notes" title="Notes">
          <NotebookPen className="h-5 w-5" />
        </button>
        <div className="relative">
          <button onClick={() => setViewMenu((o) => !o)} className={iconBtn} aria-label="View" title="View">
            {view === "gallery" ? <LayoutGrid className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
          </button>
          {viewMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setViewMenu(false)} />
              <div className="absolute right-0 top-9 z-40 w-40 animate-fade-up rounded-lg bg-[#2B2B2B] py-1 text-sm shadow-pop">
                {(["speaker", "gallery"] as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      onViewChange(v);
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
      </div>
      {infoOpen && <MeetingInfo meeting={meeting} myName={myName} onClose={() => onInfoOpenChange(false)} />}
    </div>
  );
}
