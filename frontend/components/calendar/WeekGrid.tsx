"use client";

import { useEffect, useRef } from "react";
import { isSameDay } from "@/lib/format";
import { placeEvents } from "@/lib/calendar";
import type { Meeting } from "@/lib/types";

const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface Props {
  days: Date[];
  meetings: Meeting[];
  now: number;
  onSlotClick: (start: Date) => void;
  onEventClick: (meeting: Meeting) => void;
}

/** Zoom / Google style time grid: one column per day, one row per hour. */
export default function WeekGrid({ days, meetings, now, onSlotClick, onEventClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Start scrolled to 8 AM, where most meetings are.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_PX - 8;
  }, []);

  const today = new Date(now);
  const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Day headers */}
      <div className="flex border-b border-zoom-border pl-14">
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className="flex-1 py-2 text-center">
              <p className={`text-xs font-semibold uppercase ${isToday ? "text-zoom-blue" : "text-zoom-muted"}`}>
                {d.toLocaleDateString([], { weekday: "short" })}
              </p>
              <p
                className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold ${
                  isToday ? "bg-zoom-blue text-white" : "text-zoom-ink"
                }`}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Hours */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
          <div className="w-14 shrink-0">
            {HOURS.map((h) => (
              <div key={h} className="relative text-right text-[11px] text-zoom-muted" style={{ height: HOUR_PX }}>
                {h > 0 && <span className="absolute -top-2 right-2">{hourLabel(h)}</span>}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayMeetings = meetings.filter((m) => {
              const start = new Date(m.scheduled_start ?? m.started_at ?? m.created_at);
              return isSameDay(start, day);
            });
            const isToday = isSameDay(day, today);
            const nowTop = ((today.getHours() * 60 + today.getMinutes()) / 60) * HOUR_PX;

            return (
              <div key={day.toISOString()} className="relative flex-1 border-l border-zoom-border">
                {/* Clickable half hour slots */}
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-zoom-border/70" style={{ height: HOUR_PX }}>
                    {[0, 30].map((min) => (
                      <button
                        key={min}
                        className="block w-full hover:bg-zoom-blue-light/60"
                        style={{ height: HOUR_PX / 2 }}
                        aria-label={`Schedule on ${day.toLocaleDateString()} at ${new Date(2000, 0, 1, h, min).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                        onClick={() => {
                          const start = new Date(day);
                          start.setHours(h, min, 0, 0);
                          onSlotClick(start);
                        }}
                      />
                    ))}
                  </div>
                ))}

                {/* Meetings */}
                {placeEvents(dayMeetings).map(({ meeting, start, end, lane, lanes }) => {
                  const top = ((start.getHours() * 60 + start.getMinutes()) / 60) * HOUR_PX;
                  const height = Math.max(22, ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_PX - 2);
                  const past = end.getTime() < now;
                  const live = meeting.status === "live";
                  return (
                    <button
                      key={meeting.id}
                      onClick={() => onEventClick(meeting)}
                      className={`absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-xs shadow-sm transition-colors ${
                        live
                          ? "border-green-600 bg-green-100 text-green-900 hover:bg-green-200"
                          : past
                            ? "border-zoom-muted bg-zoom-surface text-zoom-muted hover:bg-zoom-border/60"
                            : "border-zoom-blue bg-zoom-blue-light text-zoom-ink hover:bg-[#d6e3ff]"
                      }`}
                      style={{
                        top,
                        height,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                      }}
                    >
                      <span className="block truncate font-semibold">{meeting.title}</span>
                      {height > 34 && (
                        <span className="block truncate">
                          {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          {live && " · Live"}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Current time line */}
                {isToday && (
                  <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center" style={{ top: nowTop }}>
                    <span className="-ml-1 h-2 w-2 rounded-full bg-zoom-red" />
                    <span className="h-0.5 flex-1 bg-zoom-red" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
