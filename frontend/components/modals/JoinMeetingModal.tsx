"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { parseMeetingInput } from "@/lib/format";
import { loadDisplayName } from "@/lib/session";
import { useCurrentUser } from "@/components/providers/UserProvider";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Zoom's "Join meeting" dialog: Meeting ID or link, your name, audio and video options. */
export default function JoinMeetingModal({ open, onClose }: Props) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [meetingInput, setMeetingInput] = useState("");
  const [name, setName] = useState("");
  const [noAudio, setNoAudio] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (open) {
      setName(loadDisplayName() || user?.name || "");
      setError(null);
    }
  }, [open, user]);

  const parsed = parseMeetingInput(meetingInput);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed) {
      setError("Please enter a valid Meeting ID (9 to 11 digits) or invite link.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      // Make sure the meeting exists before moving on.
      const meeting = await api.lookupMeeting(parsed.code);
      if (meeting.status === "ended") {
        setError("This meeting has ended.");
        return;
      }
      const params = new URLSearchParams({ name: name.trim() });
      if (parsed.passcode) params.set("pwd", parsed.passcode);
      if (noAudio) params.set("audio", "off");
      if (videoOff) params.set("video", "off");
      onClose();
      router.push(`/j/${meeting.meeting_code}?${params.toString()}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Join meeting" width="max-w-sm">
      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <input
            autoFocus
            className="input text-base"
            placeholder="Meeting ID or personal link name"
            value={meetingInput}
            onChange={(e) => setMeetingInput(e.target.value)}
            aria-label="Meeting ID or invite link"
          />
        </div>
        <div>
          <input
            className="input text-base"
            placeholder="Enter your name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            aria-label="Your name"
          />
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-zoom-blue" checked={noAudio} onChange={(e) => setNoAudio(e.target.checked)} />
            Don&apos;t connect to audio
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-zoom-blue" checked={videoOff} onChange={(e) => setVideoOff(e.target.checked)} />
            Turn off my video
          </label>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
        <p className="text-xs text-zoom-muted">
          By clicking &quot;Join&quot;, you agree to the Terms of Service and Privacy Statement.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary min-w-20" disabled={!meetingInput.trim() || !name.trim() || checking}>
            {checking ? <Spinner className="h-4 w-4" /> : "Join"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
