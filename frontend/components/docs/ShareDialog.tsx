"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { DocumentFull } from "@/lib/types";

interface Props {
  doc: DocumentFull;
  open: boolean;
  onClose: () => void;
  onChange: (doc: DocumentFull) => void;
}

/** Share a document with people by email, as editor or viewer. */
export default function ShareDialog({ doc, open, onClose, onChange }: Props) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [canEdit, setCanEdit] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const share = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onChange(await api.shareDocument(doc.id, email.trim(), canEdit));
      toast(`Shared with ${email.trim()}`, "success");
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const change = async (userEmail: string, edit: boolean) => {
    try {
      onChange(await api.shareDocument(doc.id, userEmail, edit));
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const unshare = async (userId: number) => {
    try {
      onChange(await api.unshareDocument(doc.id, userId));
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Share "${doc.title}"`}>
      {doc.is_owner && (
        <form onSubmit={share} className="space-y-2">
          <label className="label" htmlFor="share-email">Add people by email</label>
          <div className="flex gap-2">
            <input
              id="share-email"
              type="email"
              className="input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <select className="input w-28" value={canEdit ? "edit" : "view"} onChange={(e) => setCanEdit(e.target.value === "edit")} aria-label="Access">
              <option value="edit">Can edit</option>
              <option value="view">Can view</option>
            </select>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
          <button type="submit" className="btn-primary" disabled={saving || !email.trim()}>
            {saving ? <Spinner className="h-4 w-4" /> : "Share"}
          </button>
        </form>
      )}

      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-zoom-muted">People with access</p>
      <ul className="space-y-1">
        <li className="flex items-center gap-2.5 py-1.5">
          <Avatar name={doc.owner.name} color={doc.owner.avatar_color} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{doc.owner.name}</span>
            <span className="block truncate text-xs text-zoom-muted">{doc.owner.email}</span>
          </span>
          <span className="text-xs text-zoom-muted">Owner</span>
        </li>
        {doc.members.map(({ user, can_edit }) => (
          <li key={user.id} className="flex items-center gap-2.5 py-1.5">
            <Avatar name={user.name} color={user.avatar_color} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-zoom-muted">{user.email}</span>
            </span>
            {doc.is_owner ? (
              <>
                <select
                  className="rounded-md border border-zoom-border bg-white px-1.5 py-1 text-xs"
                  value={can_edit ? "edit" : "view"}
                  onChange={(e) => change(user.email, e.target.value === "edit")}
                  aria-label={`Access for ${user.name}`}
                >
                  <option value="edit">Can edit</option>
                  <option value="view">Can view</option>
                </select>
                <button onClick={() => unshare(user.id)} className="rounded p-1 text-zoom-muted hover:bg-zoom-surface hover:text-zoom-red" aria-label={`Remove ${user.name}`}>
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <span className="text-xs text-zoom-muted">{can_edit ? "Can edit" : "Can view"}</span>
            )}
          </li>
        ))}
      </ul>
      {!doc.is_owner && <p className="mt-3 text-xs text-zoom-muted">Only the owner can change who has access.</p>}
    </Modal>
  );
}
