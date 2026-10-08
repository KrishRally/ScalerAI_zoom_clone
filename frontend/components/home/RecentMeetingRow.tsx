import { Clock, Video } from "lucide-react";
import { formatDuration, formatMeetingCode, formatTime, relativeDay } from "@/lib/format";
import type { Meeting } from "@/lib/types";

/** One finished (or still running) meeting in the "Recent" list. */
export default function RecentMeetingRow({ meeting }: { meeting: Meeting }) {
  const started = meeting.started_at!;
  const minutes = meeting.ended_at
    ? Math.max(1, Math.round((new Date(meeting.ended_at).getTime() - new Date(started).getTime()) / 60_000))
    : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-zoom-surface">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zoom-blue-light text-zoom-blue">
        <Video className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-zoom-ink">{meeting.title}</p>
        <p className="text-xs text-zoom-muted">
          {relativeDay(started)}, {formatTime(started)} · ID {formatMeetingCode(meeting.meeting_code)}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-xs text-zoom-muted">
        {meeting.status === "live" ? (
          <span className="rounded bg-green-100 px-1.5 py-0.5 font-bold text-green-700">In progress</span>
        ) : (
          <>
            <Clock className="h-3.5 w-3.5" /> {minutes !== null ? formatDuration(minutes) : ""}
          </>
        )}
      </span>
    </li>
  );
}
