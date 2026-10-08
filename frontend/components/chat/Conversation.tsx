"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Hash, SendHorizontal, Star } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatTime, isSameDay } from "@/lib/format";
import type { Channel, ChannelMessage } from "@/lib/types";

const POLL_MS = 2500;
// Messages from the same person within this time are grouped under one name.
const GROUP_MS = 5 * 60_000;

interface Props {
  channel: Channel;
  meId: number;
  starred: boolean;
  onToggleStar: () => void;
  onBack: () => void;
  onActivity: () => void;
}

/** The open conversation: header, messages and the message box. */
export default function Conversation({ channel, meId, starred, onToggleStar, onBack, onActivity }: Props) {
  const toast = useToast();
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const addMessages = useCallback((incoming: ChannelMessage[]) => {
    if (!incoming.length) return;
    lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...incoming.filter((m) => !seen.has(m.id))];
    });
  }, []);

  // Load the conversation, then check for new messages every few seconds.
  useEffect(() => {
    let stopped = false;
    lastId.current = 0;
    setMessages([]);
    setLoading(true);

    const load = async () => {
      try {
        const fresh = await api.channelMessages(channel.id, lastId.current);
        if (stopped) return;
        if (fresh.length) {
          addMessages(fresh);
          // We're looking at it, so it's read.
          api.markChannelRead(channel.id).then(onActivity).catch(() => {});
        }
      } catch {
        // Try again on the next tick.
      } finally {
        if (!stopped) setLoading(false);
      }
    };
    load();
    api.markChannelRead(channel.id).then(onActivity).catch(() => {});
    const id = setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // onActivity only refreshes the list; re-running for it would reload messages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, addMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      addMessages([await api.sendChannelMessage(channel.id, content)]);
      setText("");
      onActivity();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  };

  const other = channel.is_direct ? channel.members.find((m) => m.id !== meId) ?? channel.members[0] : null;
  const placeholder = channel.is_direct ? `Message ${channel.name}` : `Message #${channel.name}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zoom-border px-4 py-3">
        <button onClick={onBack} className="rounded p-1 text-zoom-muted hover:bg-zoom-surface md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {other ? (
          <Avatar name={other.name} color={other.avatar_color} size={32} />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-[28%] bg-zoom-blue-light text-zoom-blue">
            <Hash className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold text-zoom-ink">{channel.name}</h2>
          <p className="truncate text-xs text-zoom-muted">
            {channel.is_direct ? other?.email : `${channel.members.length} member${channel.members.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={onToggleStar}
          className={`rounded-lg p-2 hover:bg-zoom-surface ${starred ? "text-amber-400" : "text-zoom-muted hover:text-zoom-ink"}`}
          aria-label={starred ? "Unstar" : "Star"}
          aria-pressed={starred}
          title={starred ? "Unstar" : "Star"}
        >
          <Star className="h-5 w-5" fill={starred ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!loading && messages.length === 0 && (
          <div className="mt-16 text-center">
            <p className="font-semibold text-zoom-ink">This is the start of {channel.is_direct ? `your chat with ${channel.name}` : `#${channel.name}`}</p>
            <p className="mt-1 text-sm text-zoom-muted">Say hello!</p>
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const date = new Date(m.created_at);
          const newDay = !prev || !isSameDay(new Date(prev.created_at), date);
          const grouped = !newDay && prev.sender.id === m.sender.id && date.getTime() - new Date(prev.created_at).getTime() < GROUP_MS;
          return (
            <div key={m.id}>
              {newDay && <DayDivider date={date} />}
              <div className={`group flex gap-3 rounded-lg px-2 hover:bg-zoom-surface ${grouped ? "py-0.5" : "mt-2 py-1"}`}>
                <div className="w-9 shrink-0">
                  {!grouped && <Avatar name={m.sender.name} color={m.sender.avatar_color} size={36} />}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <p className="text-sm">
                      <span className="font-bold text-zoom-ink">{m.sender.id === meId ? "You" : m.sender.name}</span>
                      <span className="ml-2 text-xs text-zoom-muted">{formatTime(m.created_at)}</span>
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm text-zoom-text">{m.content}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Message box */}
      <div className="border-t border-zoom-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-zoom-border px-3 py-2 focus-within:border-zoom-blue focus-within:ring-2 focus-within:ring-zoom-blue/20">
          <textarea
            rows={1}
            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-zoom-muted"
            placeholder={placeholder}
            value={text}
            maxLength={4000}
            aria-label={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a new line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="rounded-lg p-1.5 text-zoom-blue hover:bg-zoom-blue-light disabled:text-zoom-muted disabled:hover:bg-transparent"
            aria-label="Send"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DayDivider({ date }: { date: Date }) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const label = isSameDay(date, today)
    ? "Today"
    : isSameDay(date, yesterday)
      ? "Yesterday"
      : date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="my-4 flex items-center gap-3 text-xs font-semibold text-zoom-muted">
      <span className="h-px flex-1 bg-zoom-border" />
      {label}
      <span className="h-px flex-1 bg-zoom-border" />
    </div>
  );
}
