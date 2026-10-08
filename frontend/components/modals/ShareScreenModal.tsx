"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import SharePicker from "@/components/share/SharePicker";
import { useAuth } from "@/components/providers/AuthProvider";
import { rememberJoin } from "@/hooks/useStartMeeting";
import { api } from "@/lib/api";
import { parseMeetingInput } from "@/lib/format";
import { clearMeetingSession } from "@/lib/session";
import { setPendingShare } from "@/lib/shareScreen";
import type { JoinResult, MeetingLookup } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "id" | "passcode" | "pick";

/**
 * Zoom's "Share screen" from the home page: enter the meeting ID, then the
 * passcode if the meeting has one, then choose what to share. You join the
 * meeting with your mic muted and camera off, and your screen is shared.
 */
export default function ShareScreenModal({ open, onClose }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("id");
  const [input, setInput] = useState("");
  const [passcode, setPasscode] = useState("");
  const [meeting, setMeeting] = useState<MeetingLookup | null>(null);
  const [joined, setJoined] = useState<JoinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("id");
    setInput("");
    setPasscode("");
    setMeeting(null);
    setJoined(null);
    setError(null);
  }, [open]);

  // We are already in the meeting while choosing what to share. Keep checking in,
  // or after 30 seconds the server would treat us as gone.
  useEffect(() => {
    if (step !== "pick" || !joined || !meeting) return;
    const id = setInterval(() => api.roomState(meeting.meeting_code, joined.id, 0).catch(() => {}), 10_000);
    return () => clearInterval(id);
  }, [step, joined, meeting]);

  if (!open) return null;

  const join = async (m: MeetingLookup, pwd?: string) => {
    const me = await api.joinMeeting(m.meeting_code, {
      display_name: user?.name ?? "Guest",
      passcode: pwd,
      is_muted: true,
      is_video_on: false,
    });
    rememberJoin(m.meeting_code, me);
    setJoined(me);
    setStep("pick");
  };

  // Step 1: which meeting?
  const submitId = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseMeetingInput(input);
    if (!parsed) return setError("Please enter a valid meeting ID (9 to 11 digits) or invite link.");
    setBusy(true);
    setError(null);
    try {
      const m = await api.lookupMeeting(parsed.code);
      const isOwner = !!user && m.host_id === user.id;
      if (m.status === "ended" && !isOwner) return setError("This meeting has ended.");
      setMeeting(m);
      // The owner doesn't need the passcode, and an invite link already carries it.
      if (m.requires_passcode && !isOwner && !parsed.passcode) {
        setStep("passcode");
      } else {
        await join(m, isOwner ? undefined : parsed.passcode);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Step 2: the passcode, checked by joining.
  const submitPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting) return;
    setBusy(true);
    setError(null);
    try {
      await join(meeting, passcode.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Step 3: the screen is chosen: go into the meeting, which starts sharing it.
  const share = (stream: MediaStream, withVideo: boolean) => {
    if (!meeting) return;
    setPendingShare(meeting.meeting_code, stream, withVideo);
    onClose();
    router.push(`/meeting/${meeting.meeting_code}`);
  };

  // Closing the picker without sharing: leave the meeting we just joined.
  const cancel = () => {
    if (joined && meeting) {
      api.leave(joined.id).catch(() => {});
      clearMeetingSession(meeting.meeting_code);
    }
    onClose();
  };

  if (step === "pick") return <SharePicker open onClose={cancel} onShare={share} />;

  return (
    <Modal open onClose={cancel} title="Share Screen" width="max-w-sm">
      {step === "id" ? (
        <form onSubmit={submitId} className="space-y-4">
          <input
            autoFocus
            className="input text-base"
            placeholder="Enter sharing key or meeting ID"
            aria-label="Sharing key or meeting ID"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={cancel}>Cancel</button>
            <button type="submit" className="btn-primary min-w-20" disabled={!input.trim() || busy}>
              {busy ? <Spinner className="h-4 w-4" /> : "Share"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitPasscode} className="space-y-4">
          <p className="text-sm text-zoom-muted">
            Please enter the meeting passcode for <span className="font-semibold text-zoom-ink">{meeting?.title}</span>
          </p>
          <input
            autoFocus
            className="input text-base"
            placeholder="Meeting passcode"
            aria-label="Meeting passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={cancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!passcode.trim() || busy}>
              {busy ? <Spinner className="h-4 w-4" /> : "Share Screen"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
