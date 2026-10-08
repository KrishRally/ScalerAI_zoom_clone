// Small helpers for showing IDs, dates and times the way Zoom does.

/** "8452391047" -> "845 239 1047", "84523910476" -> "845 2391 0476" */
export function formatMeetingCode(code: string): string {
  const digits = code.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  return digits;
}

/** Pull a meeting ID out of whatever the user typed or pasted (ID or invite link). */
export function parseMeetingInput(raw: string): { code: string; passcode?: string } | null {
  const text = raw.trim();
  const link = text.match(/\/j\/(\d{9,11})(?:\?[^#]*?pwd=([A-Za-z0-9]+))?/);
  if (link) return { code: link[1], passcode: link[2] };
  const digits = text.replace(/[\s-]/g, "");
  if (/^\d{9,11}$/.test(digits)) return { code: digits };
  return null;
}

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Today", "Tomorrow" or "Wed, Oct 8" */
export function relativeDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, tomorrow)) return "Tomorrow";
  return formatDate(iso);
}

/** "10:00 AM - 11:00 AM" */
export function timeRange(startIso: string, minutes: number): string {
  const end = new Date(new Date(startIso).getTime() + minutes * 60_000);
  return `${formatTime(startIso)} - ${formatTime(end.toISOString())}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

/** Elapsed time "MM:SS" or "H:MM:SS" since a start time. */
export function elapsed(sinceIso: string, now: number): string {
  const total = Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The text Zoom copies when you click "Copy invitation". */
export function invitationText(m: {
  host_name: string;
  title: string;
  scheduled_start: string | null;
  invite_link: string;
  meeting_code: string;
  passcode: string;
}): string {
  const lines = [`${m.host_name} is inviting you to a scheduled Zoom meeting.`, "", `Topic: ${m.title}`];
  if (m.scheduled_start) {
    lines.push(`Time: ${new Date(m.scheduled_start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`);
  }
  lines.push(
    "",
    "Join Zoom Meeting",
    m.invite_link,
    "",
    `Meeting ID: ${formatMeetingCode(m.meeting_code)}`,
    `Passcode: ${m.passcode}`,
  );
  return lines.join("\n");
}

/** Stable color for an avatar based on the name. */
const AVATAR_COLORS = ["#0B5CFF", "#E8710A", "#1E8E3E", "#A142F4", "#D93025", "#12A4AF", "#C2185B"];
export function colorFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** "Just now", "5m ago", "3h ago", then a date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}
