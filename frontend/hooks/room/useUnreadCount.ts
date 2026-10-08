"use client";

import { useEffect, useRef } from "react";

/** How many chat messages arrived while the chat panel was closed. Messages from before we joined don't count. */
export function useUnreadCount(total: number, chatOpen: boolean): number {
  const seen = useRef<number | null>(null);
  if (seen.current === null) seen.current = total;
  useEffect(() => {
    if (chatOpen) seen.current = total;
  }, [chatOpen, total]);
  return chatOpen ? 0 : Math.max(0, total - (seen.current ?? 0));
}
