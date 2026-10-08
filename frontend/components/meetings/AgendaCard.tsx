"use client";

import { useState } from "react";
import { Copy, MoreHorizontal, Pencil, Trash2, Video } from "lucide-react";
import { useCopy } from "@/hooks/useCopy";
import { meetingTimes } from "@/lib/calendar";
import { formatTime, invitationText } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface Props {
  meeting: Meeting;
  onOpen: (m: Meeting) => void;
  onStart: (m: Meeting) => void;
  onEdit: (m: Meeting) => void;
  onDelete: (m: Meeting) => void;
}

/** One meeting in the Agenda: start and end time, title, host, and a "..." menu. */
export default function AgendaCard({ meeting, onOpen, onStart, onEdit, onDelete }: Props) {
  const copy = useCopy();
  const [menu, setMenu] = useState(false);
  const { start, end } = meetingTimes(meeting);
  const ended = meeting.status === "ended" || end.getTime() < Date.now();
  const live = meeting.status === "live";

  const item = (label: string, Icon: typeof Video, action: () => void, danger = false) => (
    <button
      onClick={() => {
        setMenu(false);
        action();
      }}
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-zoom-surface ${danger ? "text-zoom-red" : ""}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <li className="relative">
      <div className={`flex items-stretch rounded-xl border border-zoom-border bg-white transition-shadow hover:shadow-card ${ended ? "opacity-80" : ""}`}>
        <button onClick={() => onOpen(meeting)} className="flex min-w-0 flex-1 items-stretch gap-3 px-3 py-3 text-left sm:gap-4 sm:px-6">
          <span className="w-[68px] shrink-0 whitespace-nowrap text-right sm:w-20">
            <span className={`block text-[15px] font-semibold ${ended ? "text-zoom-muted" : "text-zoom-ink"}`}>{formatTime(start.toISOString())}</span>
            <span className="block text-xs text-zoom-muted">{formatTime(end.toISOString())}</span>
          </span>
          <span className={`w-[3px] shrink-0 rounded-full ${ended ? "bg-zoom-blue/40" : "bg-zoom-blue"}`} />
          <span className="min-w-0 flex-1">
            <span className={`flex items-center gap-1.5 text-[15px] font-semibold ${ended ? "text-zoom-muted" : "text-zoom-ink"}`}>
              {meeting.meeting_type === "instant" && <Video className="h-4 w-4 shrink-0" />}
              <span className="truncate">{meeting.title}</span>
              {live && <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">LIVE</span>}
            </span>
            <span className="block truncate text-xs text-zoom-muted">Host: {meeting.host_name}</span>
          </span>
        </button>
        <div className="flex items-center gap-1 pr-3">
          {!ended && (
            <button onClick={() => onStart(meeting)} className={`${live ? "btn-primary" : "btn-secondary"} hidden px-3 py-1 text-sm sm:inline-flex`}>
              {live ? "Join" : "Start"}
            </button>
          )}
          <button onClick={() => setMenu((o) => !o)} className="rounded-md p-1.5 text-zoom-text hover:bg-zoom-surface" aria-label={`More options for ${meeting.title}`}>
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-3 top-12 z-20 w-48 animate-fade-up rounded-xl border border-zoom-border bg-white py-1.5 shadow-pop">
            {!ended && item(live ? "Join" : "Start", Video, () => onStart(meeting))}
            {!ended && item("Copy invitation", Copy, () => copy(invitationText(meeting), "Invitation"))}
            {!ended && meeting.meeting_type === "scheduled" && item("Edit", Pencil, () => onEdit(meeting))}
            {item("Delete", Trash2, () => onDelete(meeting), true)}
          </div>
        </>
      )}
    </li>
  );
}
