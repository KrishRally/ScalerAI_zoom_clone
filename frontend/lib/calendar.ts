// Date helpers for the Calendar page. All in the browser's local time.
import type { Meeting } from "./types";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Sunday of the week containing `d`, like Zoom's calendar. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

/** When a meeting starts and ends on the calendar. */
export function meetingTimes(m: Meeting): { start: Date; end: Date } {
  const start = new Date(m.scheduled_start ?? m.started_at ?? m.created_at);
  let minutes = m.duration_minutes;
  // Instant meetings that already ended show how long they really lasted.
  if (!m.scheduled_start && m.started_at && m.ended_at) {
    minutes = Math.max(15, (new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 60_000);
  }
  return { start, end: new Date(start.getTime() + minutes * 60_000) };
}

export interface PlacedEvent {
  meeting: Meeting;
  start: Date;
  end: Date;
  /** Which side-by-side lane this event uses, and how many lanes share its time. */
  lane: number;
  lanes: number;
}

/**
 * Lay out one day's meetings so overlapping ones sit side by side.
 * Meetings that overlap form a cluster; each gets the first free lane in it.
 */
export function placeEvents(meetings: Meeting[]): PlacedEvent[] {
  const items = meetings
    .map((m) => ({ meeting: m, ...meetingTimes(m) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const placed: PlacedEvent[] = [];
  let cluster: PlacedEvent[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = 0;

  const closeCluster = () => {
    cluster.forEach((e) => (e.lanes = laneEnds.length));
    cluster = [];
    laneEnds = [];
  };

  for (const item of items) {
    const s = item.start.getTime();
    if (cluster.length && s >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = item.end.getTime();
    clusterEnd = Math.max(clusterEnd, item.end.getTime());
    const event = { ...item, lane, lanes: 1 };
    cluster.push(event);
    placed.push(event);
  }
  closeCluster();
  return placed;
}
