"use client";

import { Hash, Plus, SquarePen } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { formatTime, isSameDay } from "@/lib/format";
import type { Channel } from "@/lib/types";

interface Props {
  channels: Channel[];
  activeId: number | null;
  meId: number;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onNewChannel: () => void;
}

/** Left side of Team Chat: channels, then direct messages. */
export default function ChannelList({ channels, activeId, meId, onSelect, onNewChat, onNewChannel }: Props) {
  const groups = channels.filter((c) => !c.is_direct);
  const directs = channels.filter((c) => c.is_direct);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="text-lg font-bold text-zoom-ink">Team Chat</h1>
        <button onClick={onNewChat} className="rounded-lg p-2 text-zoom-blue hover:bg-zoom-blue-light" aria-label="New chat" title="New chat">
          <SquarePen className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <Section title="Channels" action={{ label: "Create a channel", onClick: onNewChannel }}>
          {groups.map((c) => (
            <Row key={c.id} channel={c} active={c.id === activeId} meId={meId} onSelect={onSelect}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[28%] bg-zoom-blue-light text-zoom-blue">
                <Hash className="h-4 w-4" />
              </span>
            </Row>
          ))}
        </Section>
        <Section title="Direct messages" action={{ label: "New chat", onClick: onNewChat }}>
          {directs.length === 0 && <p className="px-4 py-2 text-xs text-zoom-muted">No direct messages yet.</p>}
          {directs.map((c) => {
            const other = c.members.find((m) => m.id !== meId) ?? c.members[0];
            return (
              <Row key={c.id} channel={c} active={c.id === activeId} meId={meId} onSelect={onSelect}>
                <Avatar name={other?.name ?? c.name} color={other?.avatar_color} size={32} />
              </Row>
            );
          })}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-2">
      <div className="flex items-center justify-between px-4 py-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-zoom-muted">{title}</p>
        <button onClick={action.onClick} className="rounded p-0.5 text-zoom-muted hover:bg-zoom-surface hover:text-zoom-ink" aria-label={action.label} title={action.label}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <ul>{children}</ul>
    </section>
  );
}

function Row({
  channel,
  active,
  meId,
  onSelect,
  children,
}: {
  channel: Channel;
  active: boolean;
  meId: number;
  onSelect: (id: number) => void;
  children: React.ReactNode;
}) {
  const last = channel.last_message;
  const unread = channel.unread_count > 0 && !active;
  const when = last
    ? isSameDay(new Date(last.created_at), new Date())
      ? formatTime(last.created_at)
      : new Date(last.created_at).toLocaleDateString([], { month: "short", day: "numeric" })
    : "";
  const preview = last ? `${last.sender.id === meId ? "You" : last.sender.name.split(" ")[0]}: ${last.content}` : "No messages yet";

  return (
    <li>
      <button
        onClick={() => onSelect(channel.id)}
        className={`flex w-full items-center gap-2.5 border-l-[3px] px-4 py-2 text-left ${
          active ? "border-zoom-blue bg-zoom-blue-light" : "border-transparent hover:bg-zoom-surface"
        }`}
      >
        {children}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-sm ${unread ? "font-bold text-zoom-ink" : "font-semibold"}`}>{channel.name}</span>
            <span className="shrink-0 text-[11px] text-zoom-muted">{when}</span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className={`truncate text-xs ${unread ? "text-zoom-text" : "text-zoom-muted"}`}>{preview}</span>
            {unread && (
              <span className="shrink-0 rounded-full bg-zoom-red px-1.5 text-[10px] font-bold leading-4 text-white">
                {channel.unread_count > 99 ? "99+" : channel.unread_count}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
