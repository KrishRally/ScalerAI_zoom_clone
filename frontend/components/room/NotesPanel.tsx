"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import PanelShell from "./PanelShell";
import Spinner from "@/components/ui/Spinner";
import { api } from "@/lib/api";

interface Props {
  code: string;
  participantId: number;
  onClose: () => void;
}

type SaveState = "loading" | "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 800;

/** Private meeting notes that save as you type, like Zoom's "My Notes". */
export default function NotesPanel({ code, participantId, onClose }: Props) {
  const [text, setText] = useState("");
  const [state, setState] = useState<SaveState>("loading");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest unsaved text, so closing the panel can still save it.
  const pending = useRef<string | null>(null);

  useEffect(() => {
    api
      .getNote(code, participantId)
      .then((note) => {
        setText(note.content);
        setState("idle");
      })
      .catch(() => setState("error"));
  }, [code, participantId]);

  const save = useCallback(async () => {
    if (pending.current === null) return;
    const content = pending.current;
    pending.current = null;
    setState("saving");
    try {
      await api.saveNote(code, participantId, content);
      setState(pending.current === null ? "saved" : "saving");
    } catch {
      setState("error");
    }
  }, [code, participantId]);

  // Save whatever is left when the panel closes.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      save();
    },
    [save],
  );

  const onType = (value: string) => {
    setText(value);
    pending.current = value;
    setState("saving");
    // Wait until typing pauses, then save once.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };

  return (
    <PanelShell title="My notes" onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-zoom-muted">
          <Lock className="h-3.5 w-3.5" /> Only you can see these notes
        </p>
        {state === "loading" ? (
          <div className="flex flex-1 items-center justify-center text-zoom-blue"><Spinner /></div>
        ) : (
          <textarea
            className="input flex-1 resize-none leading-relaxed"
            placeholder="Type your notes here..."
            value={text}
            maxLength={20000}
            onChange={(e) => onType(e.target.value)}
            aria-label="Meeting notes"
            autoFocus
          />
        )}
        <p className="mt-2 h-4 text-right text-xs text-zoom-muted" aria-live="polite">
          {state === "saving" && "Saving..."}
          {state === "saved" && "Saved"}
          {state === "error" && <span className="text-zoom-red">Could not save. Check your connection.</span>}
        </p>
      </div>
    </PanelShell>
  );
}
