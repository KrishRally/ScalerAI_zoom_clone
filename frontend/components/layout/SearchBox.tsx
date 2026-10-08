"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Search, Video } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { formatMeetingCode, parseMeetingInput, relativeDay, formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";

const DEBOUNCE_MS = 250;

type Result = { kind: "meeting"; meeting: Meeting } | { kind: "join"; code: string };

/** Top bar search: find your meetings by title or Meeting ID, or join an ID you paste. */
export default function SearchBox() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Ctrl+F (Cmd+F on Mac) jumps to the search box, like in Zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search a moment after typing stops. Ignore answers to older searches.
  useEffect(() => {
    const text = q.trim();
    if (!text) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    const id = setTimeout(() => {
      api
        .searchMeetings(text)
        .then((found) => !stale && setMeetings(found))
        .catch(() => !stale && setMeetings([]))
        .finally(() => !stale && setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(id);
    };
  }, [q]);

  // A full Meeting ID or invite link that isn't one of yours: offer to join it.
  const parsed = parseMeetingInput(q);
  const results: Result[] = meetings.map((meeting) => ({ kind: "meeting" as const, meeting }));
  if (parsed && !meetings.some((m) => m.meeting_code === parsed.code)) results.push({ kind: "join", code: parsed.code });

  useEffect(() => setActive(0), [q, meetings.length]);

  const choose = (r: Result) => {
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    if (r.kind === "join") {
      router.push(`/j/${r.code}`);
    } else {
      const ended = r.meeting.status === "ended";
      router.push(`/meetings?${ended ? "tab=recent&" : ""}m=${r.meeting.id}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  const showPanel = open && q.trim().length > 0;

  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-lg bg-zoom-surface px-3 py-2 text-sm text-zoom-muted ring-zoom-blue/30 focus-within:ring-2">
        <Search className="h-4 w-4" />
        <input
          ref={inputRef}
          className="w-full bg-transparent text-zoom-text outline-none placeholder:text-zoom-muted"
          placeholder="Search (Ctrl+F)"
          aria-label="Search meetings"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="search-results"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {loading && <Spinner className="h-4 w-4 text-zoom-blue" />}
      </label>

      {showPanel && (
        <div id="search-results" role="listbox" className="absolute left-0 right-0 top-11 z-50 animate-fade-up overflow-hidden rounded-xl border border-zoom-border bg-white py-1.5 shadow-pop">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zoom-muted">{loading ? "Searching..." : `No meetings match "${q.trim()}"`}</p>
          ) : (
            <>
              {meetings.length > 0 && <p className="px-4 pb-1 pt-1.5 text-xs font-bold uppercase tracking-wide text-zoom-muted">Meetings</p>}
              {results.map((r, i) => (
                <button
                  key={r.kind === "join" ? "join" : r.meeting.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in the box, so it stays open until the click
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === active ? "bg-zoom-surface" : ""}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zoom-blue-light text-zoom-blue">
                    {r.kind === "join" ? <LogIn className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  </span>
                  {r.kind === "join" ? (
                    <span className="text-sm font-semibold text-zoom-ink">Join meeting {formatMeetingCode(r.code)}</span>
                  ) : (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zoom-ink">{r.meeting.title}</span>
                      <span className="block truncate text-xs text-zoom-muted">{describe(r.meeting)}</span>
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function describe(m: Meeting): string {
  const when = m.scheduled_start ?? m.started_at ?? m.created_at;
  const label = m.status === "live" ? "Live now" : m.status === "ended" ? `Ended · ${relativeDay(when)}` : `${relativeDay(when)} · ${formatTime(when)}`;
  return `${label} · ID ${formatMeetingCode(m.meeting_code)}`;
}
