"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ChannelList from "@/components/chat/ChannelList";
import Conversation from "@/components/chat/Conversation";
import NewChatDialog, { type NewChatMode } from "@/components/chat/NewChatDialog";
import RequireAuth from "@/components/providers/RequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import Spinner from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { api } from "@/lib/api";
import type { Channel } from "@/lib/types";

// The list is refreshed this often for new messages and unread counts.
const LIST_POLL_MS = 4000;
const STARRED_KEY = "zoom-chat-starred";

/** Starred chats, remembered in this browser only. */
function useStarred() {
  const [starred, setStarred] = useState<number[]>([]);
  useEffect(() => {
    try {
      setStarred(JSON.parse(localStorage.getItem(STARRED_KEY) || "[]"));
    } catch {
      // Storage blocked or bad data: start with nothing starred.
    }
  }, []);
  const toggle = (id: number) =>
    setStarred((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(STARRED_KEY, JSON.stringify(next));
      } catch {
        // Not saved, but still works for this visit.
      }
      return next;
    });
  return { starred, toggle };
}

/** Zoom's Chat: chats on the left, the open one (or a "start chatting" picture) on the right. */
function ChatView() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("c") ? Number(params.get("c")) : null;

  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<NewChatMode | null>(null);
  const { starred, toggle } = useStarred();

  const reload = useCallback(async () => {
    try {
      setChannels(await api.channels());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, LIST_POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  const select = (id: number | null) => router.replace(id ? `/chat?c=${id}` : "/chat");

  const markAllRead = async () => {
    await Promise.all((channels ?? []).filter((c) => c.unread_count > 0).map((c) => api.markChannelRead(c.id).catch(() => {})));
    reload();
  };

  const active = channels?.find((c) => c.id === activeId) ?? null;

  if (!user) return null;

  return (
    <AppShell>
    <div className="flex h-full flex-col bg-white">
      {error && !channels ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !channels ? (
        <div className="flex flex-1 items-center justify-center text-zoom-blue"><Spinner className="h-8 w-8" /></div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className={`w-full border-r border-zoom-border md:block md:w-80 lg:w-[22rem] ${active ? "hidden" : "block"}`}>
            <ChannelList
              channels={channels}
              activeId={activeId}
              meId={user.id}
              meName={user.name}
              starred={starred}
              onSelect={select}
              onNew={setDialog}
              onMarkAllRead={markAllRead}
            />
          </aside>
          <section className={`min-w-0 flex-1 md:block ${active ? "block" : "hidden"}`}>
            {active ? (
              <Conversation
                channel={active}
                meId={user.id}
                starred={starred.includes(active.id)}
                onToggleStar={() => toggle(active.id)}
                onBack={() => select(null)}
                onActivity={reload}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
                <ChatBubbles />
                <p className="max-w-sm text-zoom-text">Start chatting by clicking or creating a chat in the left sidebar.</p>
              </div>
            )}
          </section>
        </div>
      )}

      <NewChatDialog
        mode={dialog}
        meId={user.id}
        onClose={() => setDialog(null)}
        onDone={(c) => {
          setDialog(null);
          reload();
          select(c.id);
        }}
      />
    </div>
    </AppShell>
  );
}

/** Two light blue speech bubbles, like the empty Chat screen in Zoom. */
function ChatBubbles() {
  return (
    <svg width="220" height="170" viewBox="0 0 220 170" aria-hidden="true">
      <path d="M118 18h70a22 22 0 0 1 22 22v40a22 22 0 0 1-22 22h-6v20l-22-20h-42a22 22 0 0 1-22-22V40a22 22 0 0 1 22-22z" fill="#C9DBFF" />
      <path d="M32 52h96a24 24 0 0 1 24 24v44a24 24 0 0 1-24 24H74l-26 22v-22H32a24 24 0 0 1-24-24V76a24 24 0 0 1 24-24z" fill="#8FB4FF" />
      <circle cx="54" cy="98" r="8" fill="#fff" />
      <circle cx="80" cy="98" r="8" fill="#fff" />
      <circle cx="106" cy="98" r="8" fill="#fff" />
    </svg>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <RequireAuth>
        <ChatView />
      </RequireAuth>
    </Suspense>
  );
}
