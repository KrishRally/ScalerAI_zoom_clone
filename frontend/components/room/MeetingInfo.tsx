"use client";

import { Copy, ShieldCheck } from "lucide-react";
import { useCopy } from "@/hooks/useCopy";
import { formatMeetingCode } from "@/lib/format";
import type { Meeting } from "@/lib/types";

/** The popup behind the green shield in the top left corner of a Zoom meeting. */
export default function MeetingInfo({ meeting, myName, onClose }: { meeting: Meeting; myName: string; onClose: () => void }) {
  const copy = useCopy();
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute left-2 top-11 z-40 w-[min(340px,calc(100vw-16px))] animate-fade-up rounded-xl bg-white p-4 text-sm text-zoom-text shadow-pop">
        <h3 className="text-base font-bold text-zoom-ink">{meeting.title}</h3>
        <dl className="mt-3 space-y-2">
          <Row label="Meeting ID">{formatMeetingCode(meeting.meeting_code)}</Row>
          <Row label="Host">{meeting.host_name}</Row>
          <Row label="Passcode">{meeting.passcode}</Row>
          <Row label="Invite link">
            <span className="break-all text-zoom-blue">{meeting.invite_link}</span>
          </Row>
          <Row label="Participant">{myName}</Row>
        </dl>
        <button className="mt-3 flex items-center gap-1.5 font-semibold text-zoom-blue hover:underline" onClick={() => copy(meeting.invite_link, "Invite link")}>
          <Copy className="h-4 w-4" /> Copy link
        </button>
        <p className="mt-3 flex items-center gap-1.5 border-t border-zoom-border pt-3 text-xs text-zoom-muted">
          <ShieldCheck className="h-4 w-4 text-zoom-green" /> This meeting is protected by a passcode
        </p>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <dt className="text-zoom-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
