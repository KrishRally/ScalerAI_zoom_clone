"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock, Trash2, UserPlus } from "lucide-react";
import TopNav from "@/components/layout/TopNav";
import ShareDialog from "@/components/docs/ShareDialog";
import RequireAuth from "@/components/providers/RequireAuth";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import type { DocumentFull } from "@/lib/types";

const SAVE_DELAY_MS = 800;
// While you're not typing, check every so often whether someone else changed the doc.
const REFRESH_MS = 5000;

type SaveState = "idle" | "saving" | "saved" | "error";

/** One document: title, body, sharing. Saves as you type. */
function DocEditor() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const router = useRouter();
  const toast = useToast();

  const [doc, setDoc] = useState<DocumentFull | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [notFound, setNotFound] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ title?: string; content?: string }>({});
  const lastTyped = useRef(0);

  const applyServer = useCallback((d: DocumentFull) => {
    setDoc(d);
    setTitle(d.title);
    setContent(d.content);
  }, []);

  useEffect(() => {
    api
      .getDocument(docId)
      .then(applyServer)
      .catch(() => setNotFound(true));
  }, [docId, applyServer]);

  const save = useCallback(async () => {
    const changes = pending.current;
    if (!Object.keys(changes).length) return;
    pending.current = {};
    setState("saving");
    try {
      const saved = await api.updateDocument(docId, changes);
      setDoc(saved);
      setState(Object.keys(pending.current).length ? "saving" : "saved");
    } catch (e) {
      setState("error");
      toast((e as Error).message, "error");
    }
  }, [docId, toast]);

  // Save anything left when leaving the page.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      save();
    },
    [save],
  );

  // Pick up edits from other people, but never while you're typing.
  useEffect(() => {
    const id = setInterval(async () => {
      if (Date.now() - lastTyped.current < REFRESH_MS || Object.keys(pending.current).length) return;
      try {
        const fresh = await api.getDocument(docId);
        if (fresh.updated_at !== doc?.updated_at) applyServer(fresh);
      } catch {
        // ignore; try again later
      }
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [docId, doc?.updated_at, applyServer]);

  const edit = (changes: { title?: string; content?: string }) => {
    if (changes.title !== undefined) setTitle(changes.title);
    if (changes.content !== undefined) setContent(changes.content);
    pending.current = { ...pending.current, ...changes };
    lastTyped.current = Date.now();
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };

  const remove = async () => {
    if (!doc || !window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      pending.current = {};
      await api.deleteDocument(doc.id);
      toast("Document deleted", "success");
      router.push("/docs");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-zoom-surface">
        <TopNav />
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-zoom-border bg-white p-8 text-center shadow-card">
          <h1 className="text-xl font-bold text-zoom-ink">Document not found</h1>
          <p className="mt-2 text-sm text-zoom-muted">It may have been deleted, or it hasn&apos;t been shared with you.</p>
          <Link href="/docs" className="btn-primary mt-6">Back to Docs</Link>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-zoom-surface">
        <TopNav />
        <div className="flex justify-center py-20 text-zoom-blue"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  const readOnly = !doc.can_edit;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex min-h-screen flex-col bg-zoom-surface">
      <TopNav />
      {/* Toolbar */}
      <div className="sticky top-14 z-30 flex flex-wrap items-center gap-2 border-b border-zoom-border bg-white px-4 py-2">
        <Link href="/docs" className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-zoom-blue hover:bg-zoom-blue-light">
          <ArrowLeft className="h-4 w-4" /> Docs
        </Link>
        <span className="mr-auto text-xs text-zoom-muted" aria-live="polite">
          {readOnly ? (
            <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> View only</span>
          ) : state === "saving" ? (
            "Saving..."
          ) : state === "error" ? (
            <span className="text-zoom-red">Not saved</span>
          ) : (
            `Saved${doc.updated_by_name ? ` · last edited by ${doc.updated_by_name} at ${formatTime(doc.updated_at)}` : ""}`
          )}
        </span>
        <div className="flex -space-x-1.5">
          {[doc.owner, ...doc.members.map((m) => m.user)].slice(0, 4).map((p) => (
            <span key={p.id} className="rounded-[28%] ring-2 ring-white" title={p.name}>
              <Avatar name={p.name} color={p.avatar_color} size={26} />
            </span>
          ))}
        </div>
        <button className="btn-primary px-3 py-1.5" onClick={() => setShareOpen(true)}>
          <UserPlus className="h-4 w-4" /> Share
        </button>
        {doc.is_owner && (
          <button className="rounded-lg p-2 text-zoom-muted hover:bg-red-50 hover:text-zoom-red" onClick={remove} aria-label="Delete document" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Page */}
      <main className="flex-1 px-4 py-6 sm:py-10">
        <article className="mx-auto min-h-[70vh] max-w-3xl rounded-lg bg-white px-6 py-8 shadow-card sm:px-14 sm:py-12">
          <input
            className="w-full bg-transparent text-3xl font-bold text-zoom-ink outline-none placeholder:text-zoom-border"
            value={title}
            placeholder="Untitled"
            maxLength={200}
            readOnly={readOnly}
            onChange={(e) => edit({ title: e.target.value })}
            aria-label="Document title"
          />
          <p className="mt-1 text-xs text-zoom-muted">
            Owner: {doc.is_owner ? "You" : doc.owner.name} · {words} word{words === 1 ? "" : "s"}
          </p>
          <textarea
            className="mt-6 min-h-[55vh] w-full resize-none bg-transparent text-[15px] leading-7 text-zoom-text outline-none placeholder:text-zoom-muted"
            value={content}
            placeholder={readOnly ? "This document is empty." : "Start writing..."}
            readOnly={readOnly}
            onChange={(e) => edit({ content: e.target.value })}
            aria-label="Document content"
            autoFocus={!readOnly && !content}
          />
        </article>
      </main>

      <ShareDialog doc={doc} open={shareOpen} onClose={() => setShareOpen(false)} onChange={setDoc} />
    </div>
  );
}

export default function DocPage() {
  return (
    <RequireAuth>
      <DocEditor />
    </RequireAuth>
  );
}
