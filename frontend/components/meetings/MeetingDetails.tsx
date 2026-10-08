"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { useCopy } from "@/hooks/useCopy";
import { formatDuration, formatMeetingCode, invitationText } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface Props {
  meeting: Meeting;
  onStart?: (m: Meeting) => void;
  onEdit?: (m: Meeting) => void;
  onDelete?: (m: Meeting) => void;
  starting?: boolean;
}

/** Right hand panel on the Meetings page. */
export default function MeetingDetails({ meeting, onStart, onEdit, onDelete, starting }: Props) {
  const copy = useCopy();
  const when = meeting.scheduled_start ?? meeting.started_at;
  const isPast = meeting.status === "ended";

  return (
    <div className="p-5 sm:p-8">
      <h2 className="text-xl font-bold text-zoom-ink sm:text-2xl">{meeting.title}</h2>
      {when && (
        <p className="mt-1 text-sm text-zoom-muted">
          {new Date(when).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}
          {" · "}
          {formatDuration(meeting.duration_minutes)}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {onStart && (
          <button className="btn-primary" onClick={() => onStart(meeting)} disabled={starting}>
            {meeting.status === "live" ? "Join" : "Start"}
          </button>
        )}
        {!isPast && (
          <button className="btn-secondary" onClick={() => copy(invitationText(meeting), "Invitation")}>
            <Copy className="h-4 w-4" /> Copy invitation
          </button>
        )}
        {onEdit && !isPast && (
          <button className="btn-secondary" onClick={() => onEdit(meeting)}>
            <Pencil className="h-4 w-4" /> Edit
          </button>
        )}
        {onDelete && (
          <button className="btn-secondary text-zoom-red" onClick={() => onDelete(meeting)}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>

      <dl className="mt-6 space-y-4 border-t border-zoom-border pt-6 text-sm">
        <Row label="Meeting ID">{formatMeetingCode(meeting.meeting_code)}</Row>
        {!isPast && (
          <>
            <Row label="Passcode">{meeting.passcode}</Row>
            <Row label="Invite link">
              <span className="flex items-start gap-2">
                <span className="break-all text-zoom-blue">{meeting.invite_link}</span>
                <button
                  className="shrink-0 text-zoom-muted hover:text-zoom-ink"
                  onClick={() => copy(meeting.invite_link, "Invite link")}
                  aria-label="Copy invite link"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </span>
            </Row>
          </>
        )}
        <Row label="Host">{meeting.host_name}</Row>
        {meeting.description && (
          <Row label="Description">
            <span className="whitespace-pre-wrap">{meeting.description}</span>
          </Row>
        )}
        {meeting.started_at && <Row label="Started">{shortDateTime(meeting.started_at)}</Row>}
        {meeting.ended_at && <Row label="Ended">{shortDateTime(meeting.ended_at)}</Row>}
      </dl>
    </div>
  );
}

const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-6">
      <dt className="shrink-0 font-semibold text-zoom-muted sm:w-32">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
