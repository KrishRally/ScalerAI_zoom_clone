"use client";

import { CheckCircle2, Copy } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useCopy } from "@/hooks/useCopy";
import { formatDuration, formatMeetingCode, invitationText } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface Props {
  meeting: Meeting | null;
  onClose: () => void;
}

/** Shown after scheduling: the meeting details and invite link, ready to copy. */
export default function MeetingSavedModal({ meeting, onClose }: Props) {
  const copy = useCopy();
  if (!meeting) return null;

  const start = meeting.scheduled_start ? new Date(meeting.scheduled_start) : null;

  return (
    <Modal open onClose={onClose} title="Meeting scheduled" width="max-w-lg">
      <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
        <CheckCircle2 className="h-5 w-5" /> Your meeting has been saved
      </div>
      <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2.5 text-sm">
        <dt className="text-zoom-muted">Topic</dt>
        <dd className="font-semibold text-zoom-ink">{meeting.title}</dd>
        {start && (
          <>
            <dt className="text-zoom-muted">Time</dt>
            <dd>
              {start.toLocaleString([], { dateStyle: "full", timeStyle: "short" })}
              <span className="text-zoom-muted"> ({formatDuration(meeting.duration_minutes)})</span>
            </dd>
          </>
        )}
        <dt className="text-zoom-muted">Meeting ID</dt>
        <dd>{formatMeetingCode(meeting.meeting_code)}</dd>
        <dt className="text-zoom-muted">Passcode</dt>
        <dd>{meeting.passcode}</dd>
        <dt className="text-zoom-muted">Invite link</dt>
        <dd className="break-all text-zoom-blue">{meeting.invite_link}</dd>
      </dl>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" onClick={() => copy(meeting.invite_link, "Invite link")}>
          <Copy className="h-4 w-4" /> Copy link
        </button>
        <button className="btn-primary" onClick={() => copy(invitationText(meeting), "Invitation")}>
          <Copy className="h-4 w-4" /> Copy invitation
        </button>
      </div>
    </Modal>
  );
}
