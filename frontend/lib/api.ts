// Every call to the backend goes through this file.

import type {
  SignalData,
  AuthResult,
  Channel,
  ChannelMessage,
  ChatMessage,
  DocumentFull,
  DocumentSummary,
  JoinInput,
  JoinResult,
  Meeting,
  MeetingLookup,
  MeetingSettings,
  Note,
  Notifications,
  Participant,
  Person,
  Reaction,
  RoomState,
  ScheduleInput,
  User,
  UserSettings,
} from "./types";
import { getAuthToken, getClientId, getParticipantToken } from "./session";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Called when the server says our sign in is no longer valid. Set by the AuthProvider. */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

/** Headers that prove who we are: the signed in account, if any. */
function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Headers that prove we are this participant in a meeting. */
function asParticipant(participantId: number): Record<string, string> {
  const token = getParticipantToken(participantId);
  return token ? { "X-Participant-Token": token } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...options.headers },
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
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown, headers: Record<string, string> = {}) =>
  request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });

/** POST as a participant, for actions inside a meeting. */
const postAs = <T>(participantId: number, path: string, body?: unknown) =>
  post<T>(path, body, asParticipant(participantId));

const code = (c: string) => encodeURIComponent(c);

export const api = {
  // ---------- Account ----------
  signUp: (name: string, email: string, password: string) =>
    post<AuthResult>("/api/auth/signup", { name, email, password }),
  signIn: (email: string, password: string) => post<AuthResult>("/api/auth/login", { email, password }),
  signOut: () => post<void>("/api/auth/logout"),
  me: () => request<User>("/api/users/me"),
  updateProfile: (changes: Partial<Pick<User, "name" | "avatar_color">>) =>
    request<User>("/api/users/me", { method: "PATCH", body: JSON.stringify(changes) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<void>("/api/users/me/password", { current_password: currentPassword, new_password: newPassword }),
  getUserSettings: () => request<UserSettings>("/api/users/me/settings"),
  updateUserSettings: (changes: Partial<UserSettings>) =>
    request<UserSettings>("/api/users/me/settings", { method: "PATCH", body: JSON.stringify(changes) }),

  searchPeople: (q: string) => request<Person[]>(`/api/users/search?q=${encodeURIComponent(q)}`),

  // ---------- Team Chat ----------
  channels: () => request<Channel[]>("/api/chat/channels"),
  chatUnread: () => request<{ unread: number }>("/api/chat/unread"),

  searchMeetings: (q: string) => request<Meeting[]>(`/api/meetings/search?q=${encodeURIComponent(q)}`),

  // Notifications bell
  notifications: () => request<Notifications>("/api/notifications"),
  markNotificationsSeen: () => post<void>("/api/notifications/seen"),

  createChannel: (name: string, memberIds: number[]) =>
    post<Channel>("/api/chat/channels", { name, member_ids: memberIds }),
  openDirect: (userId: number) => post<Channel>("/api/chat/direct", { user_id: userId }),
  channelMessages: (channelId: number, afterId = 0) =>
    request<ChannelMessage[]>(`/api/chat/channels/${channelId}/messages?after_id=${afterId}`),
  sendChannelMessage: (channelId: number, content: string) =>
    post<ChannelMessage>(`/api/chat/channels/${channelId}/messages`, { content }),
  markChannelRead: (channelId: number) => post<void>(`/api/chat/channels/${channelId}/read`),

  // ---------- Docs ----------
  documents: () => request<DocumentSummary[]>("/api/docs"),
  createDocument: (title: string, content: string) => post<DocumentFull>("/api/docs", { title, content }),
  getDocument: (id: number) => request<DocumentFull>(`/api/docs/${id}`),
  updateDocument: (id: number, changes: { title?: string; content?: string }) =>
    request<DocumentFull>(`/api/docs/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteDocument: (id: number) => request<void>(`/api/docs/${id}`, { method: "DELETE" }),
  shareDocument: (id: number, email: string, canEdit: boolean) =>
    post<DocumentFull>(`/api/docs/${id}/members`, { email, can_edit: canEdit }),
  unshareDocument: (id: number, userId: number) =>
    request<DocumentFull>(`/api/docs/${id}/members/${userId}`, { method: "DELETE" }),

  // ---------- Meetings ----------
  calendar: (start: Date, end: Date) =>
    request<Meeting[]>(
      `/api/meetings/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
    ),
  upcomingMeetings: () => request<Meeting[]>("/api/meetings/upcoming"),
  recentMeetings: () => request<Meeting[]>("/api/meetings/recent"),
  getMeeting: (c: string) => request<Meeting>(`/api/meetings/${code(c)}`),
  lookupMeeting: (q: string) => request<MeetingLookup>(`/api/meetings/lookup?q=${encodeURIComponent(q)}`),

  createInstantMeeting: (title?: string) => post<Meeting>("/api/meetings/instant", title ? { title } : {}),
  scheduleMeeting: (input: ScheduleInput) => post<Meeting>("/api/meetings/scheduled", input),
  updateMeeting: (c: string, input: Partial<ScheduleInput>) =>
    request<Meeting>(`/api/meetings/${code(c)}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteMeeting: (c: string) => request<void>(`/api/meetings/${code(c)}`, { method: "DELETE" }),
  myNote: (c: string) => request<Note>(`/api/meetings/${code(c)}/notes/mine`),

  // ---------- Inside a meeting ----------
  // Joining sends the sign in token (if any); the server decides who is host from it.
  joinMeeting: (c: string, input: JoinInput) =>
    post<JoinResult>(`/api/meetings/${code(c)}/join`, { client_id: getClientId() || undefined, ...input }),
  roomState: (c: string, participantId: number, afterMessageId: number) =>
    request<RoomState>(
      `/api/meetings/${code(c)}/state?participant_id=${participantId}&after_message_id=${afterMessageId}`,
      { headers: asParticipant(participantId) },
    ),
  sendMessage: (c: string, participantId: number, content: string) =>
    postAs<ChatMessage>(participantId, `/api/meetings/${code(c)}/messages`, { participant_id: participantId, content }),
  sendReaction: (c: string, participantId: number, emoji: string) =>
    postAs<Reaction>(participantId, `/api/meetings/${code(c)}/reactions`, { participant_id: participantId, emoji }),

  // Notes: private to whoever writes them.
  getNote: (c: string, participantId: number) =>
    request<Note>(`/api/meetings/${code(c)}/notes?participant_id=${participantId}`, {
      headers: asParticipant(participantId),
    }),
  saveNote: (c: string, participantId: number, content: string) =>
    request<Note>(`/api/meetings/${code(c)}/notes`, {
      method: "PUT",
      body: JSON.stringify({ participant_id: participantId, content }),
      headers: asParticipant(participantId),
    }),

  updateSelf: (
    participantId: number,
    changes: Partial<Pick<Participant, "is_muted" | "is_video_on" | "is_hand_raised" | "is_sharing_screen" | "display_name">>,
  ) =>
    request<Participant>(`/api/participants/${participantId}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
      headers: asParticipant(participantId),
    }),
  leave: (participantId: number) => postAs<void>(participantId, `/api/participants/${participantId}/leave`),

  // ---------- WebRTC signalling: connection notes passed between browsers ----------
  sendSignal: (participantId: number, to: number, data: SignalData) =>
    postAs<void>(participantId, `/api/participants/${participantId}/signals`, { to, data }),
  iceServers: (participantId: number) =>
    request<{ ice_servers: unknown[]; has_relay: boolean; relay_only: boolean }>(`/api/participants/${participantId}/ice-servers`, {
      headers: asParticipant(participantId),
    }),
  takeSignals: (participantId: number) =>
    request<{ id: number; from_id: number; data: SignalData }[]>(`/api/participants/${participantId}/signals`, {
      headers: asParticipant(participantId),
    }),
  /** Like leave, but still delivered if the page is going away (Back button, closing the tab). */
  leaveInBackground: (participantId: number) => {
    fetch(`${API_URL}/api/participants/${participantId}/leave`, {
      method: "POST",
      keepalive: true,
      headers: asParticipant(participantId),
    }).catch(() => {});
  },

  // ---------- Host controls ----------
  // requester_id says who is asking; their participant key proves it.
  muteAll: (c: string, requesterId: number) =>
    postAs<{ muted: number }>(requesterId, `/api/meetings/${code(c)}/mute-all`, { requester_id: requesterId }),
  muteParticipant: (participantId: number, requesterId: number) =>
    postAs<Participant>(requesterId, `/api/participants/${participantId}/mute`, { requester_id: requesterId }),
  removeParticipant: (participantId: number, requesterId: number) =>
    postAs<void>(requesterId, `/api/participants/${participantId}/remove`, { requester_id: requesterId }),
  endMeeting: (c: string, requesterId: number) =>
    postAs<Meeting>(requesterId, `/api/meetings/${code(c)}/end`, { requester_id: requesterId }),
  updateSettings: (c: string, requesterId: number, changes: Partial<MeetingSettings>) =>
    request<MeetingSettings>(`/api/meetings/${code(c)}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ requester_id: requesterId, ...changes }),
      headers: asParticipant(requesterId),
    }),
  suspend: (c: string, requesterId: number) =>
    postAs<MeetingSettings>(requesterId, `/api/meetings/${code(c)}/suspend`, { requester_id: requesterId }),
  admit: (participantId: number, requesterId: number) =>
    postAs<Participant>(requesterId, `/api/participants/${participantId}/admit`, { requester_id: requesterId }),
  admitAll: (c: string, requesterId: number) =>
    postAs<{ admitted: number }>(requesterId, `/api/meetings/${code(c)}/admit-all`, { requester_id: requesterId }),
  renameParticipant: (participantId: number, requesterId: number, displayName: string) =>
    postAs<Participant>(requesterId, `/api/participants/${participantId}/rename`, {
      requester_id: requesterId,
      display_name: displayName,
    }),
  makeHost: (participantId: number, requesterId: number) =>
    postAs<Participant>(requesterId, `/api/participants/${participantId}/make-host`, { requester_id: requesterId }),
};
