"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { useCopy } from "@/hooks/useCopy";
import { formatMeetingCode, invitationText, relativeDay, timeRange } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface Props {
  meeting: Meeting;
  onStart: (m: Meeting) => void;
  onEdit?: (m: Meeting) => void;
  onDelete?: (m: Meeting) => void;
  disabled?: boolean;
}

export default function UpcomingMeetingRow({ meeting, onStart, onEdit, onDelete, disabled }: Props) {
  const copy = useCopy();
  const start = meeting.scheduled_start!;
  const isLive = meeting.status === "live";
  const startsSoon = new Date(start).getTime() - Date.now() < 15 * 60_000;

  return (
    <li className="group flex items-center gap-3 px-4 py-3 hover:bg-zoom-surface">
      <div className="w-1 self-stretch rounded-full bg-zoom-blue" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-zoom-muted">
          {relativeDay(start)} · {timeRange(start, meeting.duration_minutes)}
          {isLive && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">LIVE</span>}
        </p>
        <p className="truncate font-bold text-zoom-ink">{meeting.title}</p>
        <p className="text-xs text-zoom-muted">Meeting ID: {formatMeetingCode(meeting.meeting_code)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-0.5 group-hover:flex group-focus-within:flex">
          <IconButton label="Copy invitation" onClick={() => copy(invitationText(meeting), "Invitation")}>
            <Copy className="h-4 w-4" />
          </IconButton>
          {onEdit && (
            <IconButton label="Edit" onClick={() => onEdit(meeting)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
          )}
          {onDelete && (
            <IconButton label="Delete" onClick={() => onDelete(meeting)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
        </div>
        <button
          onClick={() => onStart(meeting)}
          disabled={disabled}
          className={isLive || startsSoon ? "btn-primary px-3 py-1.5" : "btn-secondary px-3 py-1.5"}
        >
          {isLive ? "Join" : "Start"}
        </button>
      </div>
    </li>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-md p-1.5 text-zoom-muted hover:bg-white hover:text-zoom-ink"
    >
      {children}
    </button>
  );
}
