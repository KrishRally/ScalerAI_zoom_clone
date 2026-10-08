// Every call to the backend goes through this file.

import type {
  ChatMessage,
  JoinInput,
  Meeting,
  MeetingLookup,
  MeetingSettings,
  Note,
  Participant,
  Reaction,
  RoomState,
  ScheduleInput,
  User,
} from "./types";
import { getClientId } from "./session";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please check your connection.", 0);
  }

  if (!res.ok) {
    let message = `Something went wrong (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      // FastAPI validation errors come back as a list.
      else if (Array.isArray(body.detail) && body.detail[0]?.msg)
        message = String(body.detail[0].msg).replace(/^Value error, /, "");
    } catch {
      // Body was not JSON; keep the generic message.
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

const code = (c: string) => encodeURIComponent(c);

export const api = {
  me: () => request<User>("/api/users/me"),

  upcomingMeetings: () => request<Meeting[]>("/api/meetings/upcoming"),
  recentMeetings: () => request<Meeting[]>("/api/meetings/recent"),
  getMeeting: (c: string) => request<Meeting>(`/api/meetings/${code(c)}`),
  lookupMeeting: (q: string) =>
    request<MeetingLookup>(`/api/meetings/lookup?q=${encodeURIComponent(q)}`),

  createInstantMeeting: (title?: string) =>
    post<Meeting>("/api/meetings/instant", title ? { title } : {}),
  scheduleMeeting: (input: ScheduleInput) => post<Meeting>("/api/meetings/scheduled", input),
  updateMeeting: (c: string, input: Partial<ScheduleInput>) =>
    request<Meeting>(`/api/meetings/${code(c)}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteMeeting: (c: string) => request<void>(`/api/meetings/${code(c)}`, { method: "DELETE" }),

  joinMeeting: (c: string, input: JoinInput) =>
    post<Participant>(`/api/meetings/${code(c)}/join`, { client_id: getClientId() || undefined, ...input }),
  roomState: (c: string, participantId: number, afterMessageId: number) =>
    request<RoomState>(
      `/api/meetings/${code(c)}/state?participant_id=${participantId}&after_message_id=${afterMessageId}`,
    ),
  sendMessage: (c: string, participantId: number, content: string) =>
    post<ChatMessage>(`/api/meetings/${code(c)}/messages`, {
      participant_id: participantId,
      content,
    }),

  sendReaction: (c: string, participantId: number, emoji: string) =>
    post<Reaction>(`/api/meetings/${code(c)}/reactions`, { participant_id: participantId, emoji }),

  // Notes: private to whoever writes them.
  getNote: (c: string, participantId: number) =>
    request<Note>(`/api/meetings/${code(c)}/notes?participant_id=${participantId}`),
  saveNote: (c: string, participantId: number, content: string) =>
    request<Note>(`/api/meetings/${code(c)}/notes`, {
      method: "PUT",
      body: JSON.stringify({ participant_id: participantId, content }),
    }),
  myNote: (c: string) => request<Note>(`/api/meetings/${code(c)}/notes/mine`),

  updateSelf: (
    participantId: number,
    changes: Partial<Pick<Participant, "is_muted" | "is_video_on" | "is_hand_raised" | "display_name">>,
  ) =>
    request<Participant>(`/api/participants/${participantId}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),
  leave: (participantId: number) => post<void>(`/api/participants/${participantId}/leave`),
  /** Like leave, but still delivered if the page is going away (Back button, closing the tab). */
  leaveInBackground: (participantId: number) => {
    fetch(`${API_URL}/api/participants/${participantId}/leave`, { method: "POST", keepalive: true }).catch(() => {});
  },

  // Host controls. requester_id lets the server check the caller is the host.
  muteAll: (c: string, requesterId: number) =>
    post<{ muted: number }>(`/api/meetings/${code(c)}/mute-all`, { requester_id: requesterId }),
  muteParticipant: (participantId: number, requesterId: number) =>
    post<Participant>(`/api/participants/${participantId}/mute`, { requester_id: requesterId }),
  removeParticipant: (participantId: number, requesterId: number) =>
    post<void>(`/api/participants/${participantId}/remove`, { requester_id: requesterId }),
  endMeeting: (c: string, requesterId: number) =>
    post<Meeting>(`/api/meetings/${code(c)}/end`, { requester_id: requesterId }),
  updateSettings: (c: string, requesterId: number, changes: Partial<MeetingSettings>) =>
    request<MeetingSettings>(`/api/meetings/${code(c)}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ requester_id: requesterId, ...changes }),
    }),
  suspend: (c: string, requesterId: number) =>
    post<MeetingSettings>(`/api/meetings/${code(c)}/suspend`, { requester_id: requesterId }),
  admit: (participantId: number, requesterId: number) =>
    post<Participant>(`/api/participants/${participantId}/admit`, { requester_id: requesterId }),
  admitAll: (c: string, requesterId: number) =>
    post<{ admitted: number }>(`/api/meetings/${code(c)}/admit-all`, { requester_id: requesterId }),
  renameParticipant: (participantId: number, requesterId: number, displayName: string) =>
    post<Participant>(`/api/participants/${participantId}/rename`, {
      requester_id: requesterId,
      display_name: displayName,
    }),
  makeHost: (participantId: number, requesterId: number) =>
    post<Participant>(`/api/participants/${participantId}/make-host`, { requester_id: requesterId }),
};
