"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import TopNav from "@/components/layout/TopNav";
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

/** Zoom's Team Chat: conversations on the left, the open one on the right. */
function ChatView() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("c") ? Number(params.get("c")) : null;

  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<NewChatMode | null>(null);

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

  // On wide screens, open the most recent conversation if none is picked.
  useEffect(() => {
    if (!activeId && channels?.length && window.matchMedia("(min-width: 768px)").matches) {
      select(channels[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, channels]);

  const active = channels?.find((c) => c.id === activeId) ?? null;

  if (!user) return null;

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      <TopNav />
      {error && !channels ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !channels ? (
        <div className="flex flex-1 items-center justify-center text-zoom-blue"><Spinner className="h-8 w-8" /></div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className={`w-full border-r border-zoom-border md:block md:w-80 lg:w-96 ${active ? "hidden" : "block"}`}>
            <ChannelList
              channels={channels}
              activeId={activeId}
              meId={user.id}
              onSelect={select}
              onNewChat={() => setDialog("direct")}
              onNewChannel={() => setDialog("channel")}
            />
          </aside>
          <section className={`min-w-0 flex-1 md:block ${active ? "block" : "hidden"}`}>
            {active ? (
              <Conversation
                channel={active}
                meId={user.id}
                onBack={() => select(null)}
                onAddPeople={() => setDialog("add-members")}
                onLeft={() => {
                  select(null);
                  reload();
                }}
                onActivity={reload}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-zoom-muted">
                <MessageSquare className="h-12 w-12 text-zoom-border" />
                <p className="text-sm">Pick a conversation or start a new chat.</p>
                <button className="btn-primary" onClick={() => setDialog("direct")}>New chat</button>
              </div>
            )}
          </section>
        </div>
      )}

      <NewChatDialog
        mode={dialog}
        channel={active}
        meId={user.id}
        onClose={() => setDialog(null)}
        onDone={(c) => {
          setDialog(null);
          reload();
          select(c.id);
        }}
      />
    </div>
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
