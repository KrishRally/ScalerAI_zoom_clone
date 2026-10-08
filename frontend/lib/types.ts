// These mirror the backend schemas in backend/app/schemas.py.

export type MeetingType = "instant" | "scheduled";
export type MeetingStatus = "scheduled" | "live" | "ended";
export type ParticipantRole = "host" | "attendee";
export type ParticipantStatus = "in_meeting" | "left" | "removed";

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
  personal_meeting_id: string;
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
}

export interface MeetingLookup {
  meeting_code: string;
  title: string;
  host_name: string;
  status: MeetingStatus;
  scheduled_start: string | null;
  requires_passcode: boolean;
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

export interface RoomState {
  meeting: Meeting;
  me: Participant;
  participants: Participant[];
  messages: ChatMessage[];
}

export interface ScheduleInput {
  title: string;
  description?: string;
  scheduled_start: string; // ISO string with timezone
  duration_minutes: number;
  passcode?: string;
}

export interface JoinInput {
  display_name: string;
  passcode?: string;
  user_id?: number;
  is_muted?: boolean;
  is_video_on?: boolean;
}
