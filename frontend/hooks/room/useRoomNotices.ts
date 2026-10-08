"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Participant } from "@/lib/types";

/** Small pop-up messages: "You are now the host", "Priya entered the waiting room". */
export function useRoomNotices(me: Participant, waiting: Participant[]) {
  const toast = useToast();

  const lastRole = useRef(me.role);
  useEffect(() => {
    if (lastRole.current !== "host" && me.role === "host") toast("You are now the host", "success");
    lastRole.current = me.role;
  }, [me.role, toast]);

  const knownWaiting = useRef(new Set<number>());
  useEffect(() => {
    for (const p of waiting) {
      if (!knownWaiting.current.has(p.id)) toast(`${p.display_name} entered the waiting room`, "info");
    }
    knownWaiting.current = new Set(waiting.map((p) => p.id));
  }, [waiting, toast]);
}
