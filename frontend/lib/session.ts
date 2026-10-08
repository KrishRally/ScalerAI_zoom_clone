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

// The microphone and camera picked on the preview screen, remembered across meetings.
export type DeviceKind = "mic" | "cam";
const deviceKey = (kind: DeviceKind) => `zoom-device-${kind}`;

export function loadDevice(kind: DeviceKind): string | undefined {
  try {
    return localStorage.getItem(deviceKey(kind)) || undefined;
  } catch {
    return undefined;
  }
}

export function saveDevice(kind: DeviceKind, deviceId: string) {
  try {
    localStorage.setItem(deviceKey(kind), deviceId);
  } catch {
    // ignore
  }
}

// "Always show this preview when joining", like Zoom. On by default.
const PREVIEW_KEY = "zoom-show-preview";

export function loadShowPreview(): boolean {
  try {
    return localStorage.getItem(PREVIEW_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveShowPreview(on: boolean) {
  try {
    localStorage.setItem(PREVIEW_KEY, on ? "on" : "off");
  } catch {
    // ignore
  }
}

// A random id for this browser tab. Sent when joining so that rejoining from
// the same tab replaces the old entry instead of showing the person twice
// (for example after pressing Back or refreshing). It lives in sessionStorage,
// which is per tab, so two tabs can still be two different people.
const CLIENT_ID_KEY = "zoom-client-id";

export function getClientId(): string {
  try {
    let id = sessionStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
