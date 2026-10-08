"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Meeting } from "@/lib/types";

/** Upcoming and recent meetings for the dashboard, with a reload function. */
export function useMeetings() {
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [recent, setRecent] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [up, rec] = await Promise.all([api.upcomingMeetings(), api.recentMeetings()]);
      setUpcoming(up);
      setRecent(rec);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // Refresh when the user comes back to the tab (for example after leaving a meeting).
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  return { upcoming, recent, loading, error, reload };
}
