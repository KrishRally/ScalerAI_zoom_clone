"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import PeoplePicker from "./PeoplePicker";
import { api } from "@/lib/api";
import type { Channel, Person } from "@/lib/types";

export type NewChatMode = "direct" | "channel";

interface Props {
  mode: NewChatMode | null;
  meId: number;
  onClose: () => void;
  onDone: (channel: Channel) => void;
}

/** Start a chat with one person, or create a channel. */
export default function NewChatDialog({ mode, meId, onClose, onDone }: Props) {
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

  const title = mode === "direct" ? "New chat" : "New channel";
  const ready = mode === "channel" ? name.trim().length > 0 : people.length > 0;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone(
        mode === "direct"
          ? await api.openDirect(people[0].id)
          : await api.createChannel(name.trim(), people.map((p) => p.id)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const exclude = mode === "channel" ? [meId] : [];

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary min-w-20" onClick={submit} disabled={!ready || saving}>
            {saving ? <Spinner className="h-4 w-4" /> : mode === "direct" ? "Chat" : "Create"}
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
          <p className="label">{mode === "direct" ? "To" : "Add people (optional)"}</p>
          <PeoplePicker selected={people} onChange={setPeople} single={mode === "direct"} excludeIds={exclude} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
      </div>
    </Modal>
  );
}
