// Screen sharing helpers shared by the Home page and the meeting room.

/** What the share picker asks, like Zoom's Share Screen window. */
export interface ShareChoice {
  /** Entire screen, one window, or one browser tab. The browser then asks which one exactly. */
  surface: "monitor" | "window" | "browser";
  /** Also send the computer's sound (Zoom's "Share sound"). */
  shareSound: boolean;
  /** Smoother motion for videos instead of sharper text (Zoom's "Optimize for video clip"). */
  optimizeVideo: boolean;
  /** Presentation option: show the presenter's own video next to the shared screen. */
  withVideo: boolean;
}

// Phone browsers (Safari on iPhone, Chrome on Android) don't let websites
// capture the screen at all, so sharing only works from a computer.
export const SHARE_UNSUPPORTED = "Screen sharing works from a computer. Phone browsers don't allow websites to share the screen.";

export function canShareScreen(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

/** Ask the browser for the screen, window or tab. Must run straight after a click. */
export async function captureScreen(choice: ShareChoice): Promise<MediaStream> {
  if (!canShareScreen()) throw new Error(SHARE_UNSUPPORTED);
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: choice.surface, frameRate: choice.optimizeVideo ? 30 : 15 },
    audio: choice.shareSound,
  });
  // A hint to the encoder: keep text sharp, or keep motion smooth.
  const track = stream.getVideoTracks()[0];
  if (track) track.contentHint = choice.optimizeVideo ? "motion" : "detail";
  return stream;
}

// Sharing from the Home page: the screen is picked there, then the app moves
// into the meeting (same page, no reload), which picks it up from here.
let pending: { code: string; stream: MediaStream; withVideo: boolean } | null = null;

export function setPendingShare(code: string, stream: MediaStream, withVideo: boolean) {
  pending?.stream.getTracks().forEach((t) => t.stop());
  pending = { code, stream, withVideo };
}

/** The share waiting for this meeting, if any. It can be taken once. */
export function takePendingShare(code: string): { stream: MediaStream; withVideo: boolean } | null {
  if (!pending || pending.code !== code) return null;
  const { stream, withVideo } = pending;
  pending = null;
  // The user may have pressed the browser's own "Stop sharing" in the meantime.
  return stream.getVideoTracks().some((t) => t.readyState === "live") ? { stream, withVideo } : null;
}

/** Drop a share that will never be used (left the waiting room, removed, meeting ended). */
export function clearPendingShare() {
  pending?.stream.getTracks().forEach((t) => t.stop());
  pending = null;
}
