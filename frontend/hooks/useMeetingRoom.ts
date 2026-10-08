"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ChatMessage, Meeting, Participant } from "@/lib/types";

const POLL_MS = 2000;

export type RoomEnd = "ended" | "removed" | "left" | "missing";

/**
 * Keeps the meeting room in sync with the server.
 *
 * Every 2 seconds it asks the server for the meeting, the participant list,
 * any new chat messages and our own status. That same call tells the server
 * we are still here (a "heartbeat").
 */
export function useMeetingRoom(code: string, participantId: number | null) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [me, setMe] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [endReason, setEndReason] = useState<RoomEnd | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const lastMessageId = useRef(0);

  const poll = useCallback(async () => {
    if (participantId === null) return;
    try {
      const state = await api.roomState(code, participantId, lastMessageId.current);
      setMeeting(state.meeting);
      setMe(state.me);
      setParticipants(state.participants);
      setConnectionLost(false);
      if (state.messages.length) {
        lastMessageId.current = state.messages[state.messages.length - 1].id;
        setMessages((prev) => {
          // Skip anything we already have (for example a message we just sent).
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...state.messages.filter((m) => !seen.has(m.id))];
        });
      }
      if (state.meeting.status === "ended") setEndReason("ended");
      else if (state.me.status === "removed") setEndReason("removed");
      else if (state.me.status === "left") setEndReason("left");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setEndReason("missing");
      else setConnectionLost(true);
    }
  }, [code, participantId]);

  useEffect(() => {
    if (participantId === null || endReason) return;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll, participantId, endReason]);

  /** Add a message we just sent without waiting for the next poll. */
  const addLocalMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  /** Update ourselves locally right away, so buttons feel instant. */
  const patchMe = useCallback((changes: Partial<Participant>) => {
    setMe((prev) => (prev ? { ...prev, ...changes } : prev));
    setParticipants((list) => list.map((p) => (p.id === participantId ? { ...p, ...changes } : p)));
  }, [participantId]);

  return {
    meeting,
    me,
    participants,
    messages,
    endReason,
    setEndReason,
    connectionLost,
    refresh: poll,
    addLocalMessage,
    patchMe,
  };
}
