"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ChatMessage, Meeting, Participant, Reaction } from "@/lib/types";

const POLL_MS = 2000;

export type RoomEnd = "ended" | "removed" | "left" | "missing";

/** The emoji currently floating over each person's tile. */
export type ReactionsByPerson = Record<number, { emoji: string; id: number }>;

/**
 * Keeps the meeting room in sync with the server.
 *
 * Every 2 seconds it asks the server for the meeting (with the host's settings),
 * the participant list, the waiting room, new chat messages, recent reactions
 * and our own status. That same call tells the server we are still here
 * (a "heartbeat").
 */
export function useMeetingRoom(code: string, participantId: number | null) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [me, setMe] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [waiting, setWaiting] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionsByPerson>({});
  const [endReason, setEndReason] = useState<RoomEnd | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const lastMessageId = useRef(0);
  // Reactions stay in the server's list for a few seconds; only animate each one once.
  const seenReactions = useRef(new Set<number>());

  /** Show a reaction over someone's tile, unless we've already shown it. */
  const showReaction = useCallback((r: Reaction) => {
    if (seenReactions.current.has(r.id)) return;
    seenReactions.current.add(r.id);
    setReactions((prev) => ({ ...prev, [r.participant_id]: { emoji: r.emoji, id: r.id } }));
  }, []);

  const poll = useCallback(async () => {
    if (participantId === null) return;
    try {
      const state = await api.roomState(code, participantId, lastMessageId.current);
      setMeeting(state.meeting);
      setMe(state.me);
      setParticipants(state.participants);
      setWaiting(state.waiting);
      setConnectionLost(false);
      if (state.messages.length) {
        lastMessageId.current = state.messages[state.messages.length - 1].id;
        setMessages((prev) => {
          // Skip anything we already have (for example a message we just sent).
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...state.messages.filter((m) => !seen.has(m.id))];
        });
      }
      state.reactions.forEach(showReaction);
      if (state.meeting.status === "ended" && state.me.status !== "waiting") setEndReason("ended");
      else if (state.me.status === "removed") setEndReason("removed");
      else if (state.me.status === "left") setEndReason(state.meeting.status === "ended" ? "ended" : "left");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setEndReason("missing");
      else setConnectionLost(true);
    }
  }, [code, participantId, showReaction]);

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
  const patchMe = useCallback(
    (changes: Partial<Participant>) => {
      setMe((prev) => (prev ? { ...prev, ...changes } : prev));
      setParticipants((list) => list.map((p) => (p.id === participantId ? { ...p, ...changes } : p)));
    },
    [participantId],
  );

  /** Apply new host settings locally right away. */
  const patchSettings = useCallback((settings: Meeting["settings"]) => {
    setMeeting((prev) => (prev ? { ...prev, settings } : prev));
  }, []);

  return {
    meeting,
    me,
    participants,
    waiting,
    messages,
    reactions,
    endReason,
    setEndReason,
    connectionLost,
    refresh: poll,
    addLocalMessage,
    patchMe,
    patchSettings,
    showReaction,
  };
}

export type MeetingRoom = ReturnType<typeof useMeetingRoom>;
