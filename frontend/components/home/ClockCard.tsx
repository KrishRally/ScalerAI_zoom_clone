"use client";

import { useNow } from "@/hooks/useNow";

/** The big centred time and date at the top of the Zoom home screen. */
export default function ClockCard() {
  const now = useNow(1000);
  const date = now ? new Date(now) : null;

  return (
    <div className="text-center">
      <p className="text-[44px] font-bold leading-tight tracking-tight text-zoom-ink sm:text-[52px]" suppressHydrationWarning>
        {date ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : " "}
      </p>
      <p className="text-lg text-zoom-muted" suppressHydrationWarning>
        {date ? date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : " "}
      </p>
    </div>
  );
}
