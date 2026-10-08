"use client";

import { useState } from "react";
import Link from "next/link";
import { AtSign, ChevronDown, ChevronRight, Hash, MessageCircle, MoreHorizontal, Plus, Settings } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { formatTime, isSameDay } from "@/lib/format";
import type { Channel } from "@/lib/types";
import type { NewChatMode } from "./NewChatDialog";

export type ChatFilter = "all" | "mentions" | "unread" | "direct" | "channels";

const MORE_FILTERS: { id: ChatFilter; label: string }[] = [
  { id: "direct", label: "Direct messages" },
  { id: "channels", label: "Channels" },
];

interface Props {
  channels: Channel[];
  activeId: number | null;
  meId: number;
  meName: string;
  starred: number[];
  onSelect: (id: number) => void;
  onNew: (mode: NewChatMode) => void;
  onMarkAllRead: () => void;
}

/** Left side of Chat, laid out like Zoom: header, filter pills, then folding sections. */
export default function ChannelList({ channels, activeId, meId, meName, starred, onSelect, onNew, onMarkAllRead }: Props) {
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [menu, setMenu] = useState<"title" | "new" | "more" | null>(null);

  const firstName = meName.split(" ")[0].toLowerCase();
  const visible = channels.filter((c) => {
    if (filter === "unread") return c.unread_count > 0;
    if (filter === "direct") return c.is_direct;
    if (filter === "channels") return !c.is_direct;
    if (filter === "mentions") {
      const last = c.last_message;
      return !!last && last.sender.id !== meId && last.content.toLowerCase().includes(`@${firstName}`);
    }
    return true;
  });
  const starredRows = visible.filter((c) => starred.includes(c.id));
  const otherRows = visible.filter((c) => !starred.includes(c.id));
  const moreLabel = MORE_FILTERS.find((f) => f.id === filter)?.label;

  const pick = (action: () => void) => {
    setMenu(null);
    action();
  };

  return (
    <div className="flex h-full flex-col bg-[#f7f7fa]">
      {/* Header: "Chat", settings and the round + button */}
      <div className="relative flex items-center gap-1 px-4 pb-3 pt-4">
        <button onClick={() => setMenu(menu === "title" ? null : "title")} className="mr-auto flex items-center gap-1 rounded-md px-1 text-xl font-bold text-zoom-ink hover:bg-white">
          Chat <ChevronDown className="h-4 w-4" />
        </button>
        <Link href="/settings" className="rounded-md p-1.5 text-zoom-muted hover:bg-white hover:text-zoom-ink" aria-label="Settings" title="Settings">
          <Settings className="h-5 w-5" />
        </Link>
        <button
          onClick={() => setMenu(menu === "new" ? null : "new")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zoom-blue text-white hover:bg-zoom-blue-hover"
          aria-label="New chat or channel"
          title="New"
        >
          <Plus className="h-5 w-5" />
        </button>
        {menu === "title" && (
          <Menu onClose={() => setMenu(null)} className="left-4 top-12">
            <MenuItem onClick={() => pick(onMarkAllRead)}>Mark all as read</MenuItem>
          </Menu>
        )}
        {menu === "new" && (
          <Menu onClose={() => setMenu(null)} className="right-4 top-12">
            <MenuItem onClick={() => pick(() => onNew("direct"))}>New chat</MenuItem>
            <MenuItem onClick={() => pick(() => onNew("channel"))}>New channel</MenuItem>
          </Menu>
        )}
      </div>

      {/* Filter pills */}
      <div className="relative flex items-center gap-2 px-4 pb-3">
        <Pill active={filter === "all"} onClick={() => setFilter("all")}>All</Pill>
        <Pill active={filter === "mentions"} onClick={() => setFilter("mentions")} label="Mentions">
          <AtSign className="h-4 w-4" />
        </Pill>
        <Pill active={filter === "unread"} onClick={() => setFilter("unread")} label="Unread">
          <MessageCircle className="h-4 w-4" />
        </Pill>
        <Pill active={!!moreLabel} onClick={() => setMenu(menu === "more" ? null : "more")} label="More filters">
          {moreLabel ?? <MoreHorizontal className="h-4 w-4" />}
        </Pill>
        {menu === "more" && (
          <Menu onClose={() => setMenu(null)} className="left-40 top-10">
            {MORE_FILTERS.map((f) => (
              <MenuItem key={f.id} onClick={() => pick(() => setFilter(f.id))}>{f.label}</MenuItem>
            ))}
          </Menu>
        )}
      </div>

      {/* Sections */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <Section title="Chats & Channels" defaultOpen>
          {otherRows.length === 0 && <Empty>{filter === "all" ? "No chats yet. Press + to start one." : "Nothing here."}</Empty>}
          {otherRows.map((c) => (
            <Row key={c.id} channel={c} active={c.id === activeId} meId={meId} onSelect={onSelect} />
          ))}
        </Section>
        <Section title="Shared spaces">
          <Empty>No shared spaces yet.</Empty>
        </Section>
        <Section title="Starred" defaultOpen={starred.length > 0}>
          {starredRows.length === 0 && <Empty>Star a chat to keep it here.</Empty>}
          {starredRows.map((c) => (
            <Row key={c.id} channel={c} active={c.id === activeId} meId={meId} onSelect={onSelect} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Pill({ active, onClick, label, children }: { active: boolean; onClick: () => void; label?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 min-w-8 items-center justify-center rounded-full border px-3 text-sm font-semibold ${
        active ? "border-zoom-blue bg-zoom-blue-light text-zoom-blue" : "border-zoom-border bg-white text-zoom-text hover:border-zoom-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-sm font-semibold text-zoom-ink hover:bg-white">
        <ChevronRight className={`h-4 w-4 text-zoom-muted transition-transform ${open ? "rotate-90" : ""}`} />
        {title}
      </button>
      {open && <ul>{children}</ul>}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="px-10 py-1.5 text-xs text-zoom-muted">{children}</li>;
}

function Menu({ onClose, className, children }: { onClose: () => void; className: string; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className={`absolute z-20 w-48 animate-fade-up rounded-xl border border-zoom-border bg-white py-1.5 shadow-pop ${className}`}>{children}</div>
    </>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="block w-full px-4 py-2 text-left text-sm hover:bg-zoom-surface">
      {children}
    </button>
  );
}

function Row({ channel, active, meId, onSelect }: { channel: Channel; active: boolean; meId: number; onSelect: (id: number) => void }) {
  const last = channel.last_message;
  const unread = channel.unread_count > 0 && !active;
  const when = last
    ? isSameDay(new Date(last.created_at), new Date())
      ? formatTime(last.created_at)
      : new Date(last.created_at).toLocaleDateString([], { month: "short", day: "numeric" })
    : "";
  const preview = last ? `${last.sender.id === meId ? "You" : last.sender.name.split(" ")[0]}: ${last.content}` : "No messages yet";
  const other = channel.is_direct ? (channel.members.find((m) => m.id !== meId) ?? channel.members[0]) : null;

  return (
    <li>
      <button
        onClick={() => onSelect(channel.id)}
        className={`flex w-full items-center gap-2.5 py-2 pl-10 pr-4 text-left ${active ? "bg-zoom-blue-light" : "hover:bg-white"}`}
      >
        {other ? (
          <Avatar name={other.name} color={other.avatar_color} size={28} />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[28%] bg-zoom-blue text-white">
            <Hash className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-sm ${unread ? "font-bold text-zoom-ink" : "font-medium text-zoom-text"}`}>{channel.name}</span>
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
