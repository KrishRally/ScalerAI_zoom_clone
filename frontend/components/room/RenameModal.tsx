"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Participant } from "@/lib/types";

interface Props {
  participant: Participant | null;
  isSelf: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

/** Zoom's "Rename" dialog, for yourself or (as host) for someone else. */
export default function RenameModal({ participant, isSelf, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (participant) setName(participant.display_name);
  }, [participant]);

  if (!participant) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Rename" width="max-w-sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="new-name">
            {isSelf ? "Enter a new name" : `Enter a new name for ${participant.display_name}`}
          </label>
          <input id="new-name" className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!name.trim() || saving}>Rename</button>
        </div>
      </form>
    </Modal>
  );
}
