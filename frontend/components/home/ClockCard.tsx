"use client";

import { useNow } from "@/hooks/useNow";
import { formatLongDate } from "@/lib/format";

/** The big time and date banner on the Zoom home screen. */
export default function ClockCard() {
  const now = useNow(1000);
  const date = now ? new Date(now) : null;

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1F3B8A] via-[#2F5BD6] to-[#6C8CF5] px-6 py-7 text-white">
      {/* Soft shapes standing in for Zoom's photo background */}
      <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />
      <div className="absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10" />
      <div className="relative">
        <p className="text-4xl font-bold tracking-tight sm:text-5xl" suppressHydrationWarning>
          {date ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : " "}
        </p>
        <p className="mt-1 text-sm font-semibold text-white/85 sm:text-base">
          {date ? formatLongDate(date) : " "}
        </p>
      </div>
    </div>
  );
}
