// These mirror the backend schemas in backend/app/schemas.py.

export type MeetingType = "instant" | "scheduled";
export type MeetingStatus = "scheduled" | "live" | "ended";
export type ParticipantRole = "host" | "attendee";
export type ParticipantStatus = "waiting" | "in_meeting" | "left" | "removed";

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
  personal_meeting_id: string;
}

/** Rules the host controls for a meeting. */
export interface MeetingSettings {
  allow_chat: boolean;
  allow_unmute: boolean;
  allow_video: boolean;
  allow_screen_share: boolean;
  allow_reactions: boolean;
  allow_rename: boolean;
  mute_on_entry: boolean;
  waiting_room: boolean;
  is_locked: boolean;
}

export interface Meeting {
  id: number;
  meeting_code: string;
  title: string;
  description: string | null;
  host_id: number;
  host_name: string;
  meeting_type: MeetingType;
  status: MeetingStatus;
  passcode: string;
  scheduled_start: string | null;
  duration_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  invite_link: string;
  participant_count: number;
  settings: MeetingSettings;
}

/** Personal defaults from the Settings page. */
export interface UserSettings {
  start_with_video: boolean;
  join_muted: boolean;
  show_preview: boolean;
  default_waiting_room: boolean;
  default_mute_on_entry: boolean;
}

export interface AuthResult {
  token: string;
  user: User;
}

/** Returned once when joining. The token proves who you are for later actions. */
export interface JoinResult extends Participant {
  participant_token: string;
}

export interface MeetingLookup {
  meeting_code: string;
  title: string;
  host_id: number;
  host_name: string;
  status: MeetingStatus;
  scheduled_start: string | null;
  requires_passcode: boolean;
  is_locked: boolean;
}

export interface Participant {
  id: number;
  meeting_id: number;
  user_id: number | null;
  display_name: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  is_muted: boolean;
  is_video_on: boolean;
  is_hand_raised: boolean;
  joined_at: string;
  left_at: string | null;
}

export interface ChatMessage {
  id: number;
  participant_id: number;
  sender_name: string;
  content: string;
  sent_at: string;
}

export interface Reaction {
  id: number;
  participant_id: number;
  emoji: string;
}

export interface Note {
  content: string;
  updated_at: string | null;
}

export interface RoomState {
  meeting: Meeting;
  me: Participant;
  participants: Participant[];
  /** People in the waiting room. Only filled in for the host. */
  waiting: Participant[];
  messages: ChatMessage[];
  /** Reactions from the last few seconds. */
  reactions: Reaction[];
}

export interface ScheduleInput {
  title: string;
  description?: string;
  scheduled_start: string; // ISO string with timezone
  duration_minutes: number;
  passcode?: string;
  waiting_room?: boolean;
  mute_on_entry?: boolean;
}

export interface JoinInput {
  display_name: string;
  passcode?: string;
  is_muted?: boolean;
  is_video_on?: boolean;
  client_id?: string;
}
