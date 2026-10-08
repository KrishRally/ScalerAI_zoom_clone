"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { PanelShell } from "./ParticipantsPanel";
import { formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  meId: number;
  onSend: (text: string) => Promise<void>;
  onClose: () => void;
}

/** In-meeting chat, sent to everyone. */
export default function ChatPanel({ messages, meId, onSend, onClose }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function submit() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSend(value);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <PanelShell title="Meeting chat" onClose={onClose}>
      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-zoom-muted">
            Messages addressed to &quot;Everyone&quot; will appear here.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.participant_id === meId;
          // Group consecutive messages from the same person, like Zoom.
          const continued = i > 0 && messages[i - 1].participant_id === m.participant_id;
          return (
            <div key={m.id} className={`flex gap-2 ${continued ? "-mt-2" : ""}`}>
              <div className="w-7 shrink-0">{!continued && <Avatar name={m.sender_name} size={28} />}</div>
              <div className="min-w-0 flex-1">
                {!continued && (
                  <p className="text-xs">
                    <span className="font-bold">{mine ? "You" : m.sender_name}</span>
                    <span className="text-zoom-muted"> to Everyone · {formatTime(m.sent_at)}</span>
                  </p>
                )}
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zoom-border p-3">
        <p className="mb-1.5 text-xs text-zoom-muted">
          To: <span className="rounded bg-zoom-blue-light px-1.5 py-0.5 font-semibold text-zoom-blue">Everyone</span>
        </p>
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            className="input resize-none"
            placeholder="Type message here..."
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a new line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            onClick={submit}
            disabled={!text.trim() || sending}
            className="rounded-lg p-2 text-zoom-blue hover:bg-zoom-blue-light disabled:text-zoom-muted disabled:hover:bg-transparent"
            aria-label="Send"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>
    </PanelShell>
  );
}
