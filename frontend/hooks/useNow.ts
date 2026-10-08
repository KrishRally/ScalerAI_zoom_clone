"use client";

import { useEffect, useState } from "react";

/** Current time in milliseconds, updated every `intervalMs`. Starts as null to avoid a server/client mismatch. */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
