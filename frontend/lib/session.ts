// Remembers which participant this browser tab is, per meeting.
// sessionStorage is per tab, so two tabs can be two different people in the same meeting.

export interface MeetingSession {
  participantId: number;
  // Choices from the join screen, so the room starts with the same mic and camera state.
  startMuted: boolean;
  startVideoOn: boolean;
}

const key = (code: string) => `zoom-meeting:${code}`;

export function saveMeetingSession(code: string, session: MeetingSession) {
  try {
    sessionStorage.setItem(key(code), JSON.stringify(session));
  } catch {
    // Storage can be blocked (private mode); the room will send the user back to join.
  }
}

export function loadMeetingSession(code: string): MeetingSession | null {
  try {
    const raw = sessionStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as MeetingSession) : null;
  } catch {
    return null;
  }
}

export function clearMeetingSession(code: string) {
  try {
    sessionStorage.removeItem(key(code));
  } catch {
    // ignore
  }
}

// The display name is remembered across visits, like Zoom does.
const NAME_KEY = "zoom-display-name";

export function loadDisplayName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

export function saveDisplayName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}
