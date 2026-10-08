"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import type { Participant } from "@/lib/types";

interface Props {
  open: boolean;
  candidates: Participant[];
  onClose: () => void;
  onAssign: (p: Participant) => Promise<void>;
}

/** Shown when the host leaves while others are still in the meeting. */
export default function AssignHostModal({ open, candidates, onClose, onAssign }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSelected(candidates[0]?.id ?? null);
    // Only pick a default when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chosen = candidates.find((p) => p.id === selected);

  const assign = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await onAssign(chosen);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign a new host"
      width="max-w-sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={assign} disabled={!chosen || busy}>Assign and leave</button>
        </>
      }
    >
      <p className="mb-3 text-sm text-zoom-muted">Choose who will take over as host when you leave.</p>
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {candidates.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-zoom-surface">
              <input
                type="radio"
                name="new-host"
                className="accent-zoom-blue"
                checked={selected === p.id}
                onChange={() => setSelected(p.id)}
              />
              <Avatar name={p.display_name} size={28} />
              <span className="text-sm">{p.display_name}</span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
