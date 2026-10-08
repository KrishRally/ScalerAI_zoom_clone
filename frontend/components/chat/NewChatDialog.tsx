"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import PeoplePicker from "./PeoplePicker";
import { api } from "@/lib/api";
import type { Channel, Person } from "@/lib/types";

export type NewChatMode = "direct" | "channel" | "add-members";

interface Props {
  mode: NewChatMode | null;
  /** For "add-members": the channel to add people to. */
  channel?: Channel | null;
  meId: number;
  onClose: () => void;
  onDone: (channel: Channel) => void;
}

/** Start a direct message, create a channel, or add people to a channel. */
export default function NewChatDialog({ mode, channel, meId, onClose, onDone }: Props) {
  const [name, setName] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName("");
    setPeople([]);
    setError(null);
  }, [mode]);

  if (!mode) return null;

  const title = mode === "direct" ? "New chat" : mode === "channel" ? "Create a channel" : `Add people to #${channel?.name}`;
  const ready = mode === "channel" ? name.trim().length > 0 : people.length > 0;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      let result: Channel;
      if (mode === "direct") result = await api.openDirect(people[0].id);
      else if (mode === "channel") result = await api.createChannel(name.trim(), people.map((p) => p.id));
      else result = await api.addChannelMembers(channel!.id, people.map((p) => p.id));
      onDone(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const exclude = mode === "add-members" ? (channel?.members.map((m) => m.id) ?? []) : mode === "channel" ? [meId] : [];

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary min-w-20" onClick={submit} disabled={!ready || saving}>
            {saving ? <Spinner className="h-4 w-4" /> : mode === "direct" ? "Chat" : mode === "channel" ? "Create" : "Add"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {mode === "channel" && (
          <div>
            <label className="label" htmlFor="channel-name">Channel name</label>
            <div className="flex items-center rounded-lg border border-zoom-border focus-within:border-zoom-blue focus-within:ring-2 focus-within:ring-zoom-blue/20">
              <span className="pl-3 text-zoom-muted">#</span>
              <input
                id="channel-name"
                className="w-full bg-transparent px-1.5 py-2 text-sm outline-none"
                placeholder="e.g. marketing"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}
        <div>
          <p className="label">{mode === "direct" ? "To" : mode === "channel" ? "Add people (optional)" : "People"}</p>
          <PeoplePicker selected={people} onChange={setPeople} single={mode === "direct"} excludeIds={exclude} />
          {mode === "direct" && <p className="mt-1.5 text-xs text-zoom-muted">Anyone with an account. You can also message yourself.</p>}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
      </div>
    </Modal>
  );
}
