"use client";

import { Copy, Pencil, Trash2, Video } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useCopy } from "@/hooks/useCopy";
import { meetingTimes } from "@/lib/calendar";
import { formatMeetingCode, formatTime, invitationText } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface Props {
  meeting: Meeting | null;
  onClose: () => void;
  onStart: (m: Meeting) => void;
  onEdit: (m: Meeting) => void;
  onDelete: (m: Meeting) => void;
}

/** What you see when you click a meeting on the calendar. */
export default function EventDetails({ meeting, onClose, onStart, onEdit, onDelete }: Props) {
  const copy = useCopy();
  if (!meeting) return null;

  const { start, end } = meetingTimes(meeting);
  const ended = meeting.status === "ended";

  return (
    <Modal open onClose={onClose} title={meeting.title}>
      <p className="text-sm text-zoom-text">
        {start.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        <br />
        <span className="text-zoom-muted">
          {formatTime(start.toISOString())} - {formatTime(end.toISOString())}
        </span>
      </p>
      {meeting.description && <p className="mt-3 whitespace-pre-wrap text-sm">{meeting.description}</p>}
      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex gap-2"><dt className="text-zoom-muted">Meeting ID</dt><dd>{formatMeetingCode(meeting.meeting_code)}</dd></div>
        {!ended && <div className="flex gap-2"><dt className="text-zoom-muted">Passcode</dt><dd>{meeting.passcode}</dd></div>}
        {ended && <div className="text-zoom-muted">This meeting has ended.</div>}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => onStart(meeting)}>
          <Video className="h-4 w-4" /> {meeting.status === "live" ? "Join" : "Start"}
        </button>
        {!ended && (
          <button className="btn-secondary" onClick={() => copy(invitationText(meeting), "Invitation")}>
            <Copy className="h-4 w-4" /> Copy invitation
          </button>
        )}
        {!ended && meeting.meeting_type === "scheduled" && (
          <button className="btn-secondary" onClick={() => onEdit(meeting)}>
            <Pencil className="h-4 w-4" /> Edit
          </button>
        )}
        <button className="btn-secondary text-zoom-red" onClick={() => onDelete(meeting)}>
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </Modal>
  );
}
