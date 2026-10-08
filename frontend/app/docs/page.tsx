"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Users } from "lucide-react";
import TopNav from "@/components/layout/TopNav";
import RequireAuth from "@/components/providers/RequireAuth";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { DOC_TEMPLATES, type DocTemplate } from "@/lib/docTemplates";
import { formatTime, isSameDay } from "@/lib/format";
import type { DocumentSummary } from "@/lib/types";

type Filter = "all" | "mine" | "shared";

/** Zoom Docs home: templates to start from, then your documents. */
function DocsHome() {
  const router = useRouter();
  const toast = useToast();
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDocs(await api.documents());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (template: DocTemplate) => {
    setCreating(template.id);
    try {
      const doc = await api.createDocument(template.title, template.content());
      router.push(`/docs/${doc.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setCreating(null);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (docs ?? []).filter((d) => {
      if (filter === "mine" && !d.is_owner) return false;
      if (filter === "shared" && d.is_owner) return false;
      return !q || d.title.toLowerCase().includes(q) || d.snippet.toLowerCase().includes(q);
    });
  }, [docs, filter, query]);

  return (
    <div className="min-h-screen bg-zoom-surface">
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <h1 className="text-2xl font-bold text-zoom-ink">Docs</h1>

        {/* Templates */}
        <section className="mt-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zoom-muted">Start a new document</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DOC_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => create(t)}
                disabled={creating !== null}
                className="group rounded-xl border border-zoom-border bg-white p-4 text-left shadow-card transition hover:border-zoom-blue hover:shadow-pop disabled:opacity-60"
              >
                <span className="flex h-16 items-center justify-center rounded-lg bg-zoom-blue-light text-zoom-blue">
                  {creating === t.id ? <Spinner className="h-5 w-5" /> : t.id === "blank" ? <Plus className="h-7 w-7" /> : <FileText className="h-7 w-7" />}
                </span>
                <span className="mt-3 block text-sm font-bold text-zoom-ink">{t.name}</span>
                <span className="block text-xs text-zoom-muted">{t.description}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Documents */}
        <section className="mt-8 rounded-xl border border-zoom-border bg-white shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-zoom-border px-4 py-3">
            <div className="flex gap-1">
              {(["all", "mine", "shared"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${filter === f ? "bg-zoom-blue-light text-zoom-blue" : "text-zoom-muted hover:text-zoom-ink"}`}
                >
                  {f === "all" ? "All" : f === "mine" ? "Owned by me" : "Shared with me"}
                </button>
              ))}
            </div>
            <label className="ml-auto flex w-full items-center gap-2 rounded-lg border border-zoom-border px-3 py-1.5 text-sm focus-within:border-zoom-blue sm:w-64">
              <Search className="h-4 w-4 text-zoom-muted" />
              <input
                className="w-full bg-transparent outline-none placeholder:text-zoom-muted"
                placeholder="Search docs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search docs"
              />
            </label>
          </div>

          {error && !docs ? (
            <ErrorState message={error} onRetry={load} />
          ) : !docs ? (
            <div className="flex justify-center py-12 text-zoom-blue"><Spinner /></div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <FileText className="h-10 w-10 text-zoom-border" />
              <p className="mt-2 text-sm font-semibold text-zoom-muted">
                {docs.length === 0 ? "No documents yet. Pick a template above to start." : "No documents match."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zoom-border">
              {visible.map((d) => (
                <li key={d.id}>
                  <Link href={`/docs/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zoom-surface">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoom-blue-light text-zoom-blue">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-zoom-ink">{d.title}</span>
                        {d.shared && <Users className="h-3.5 w-3.5 shrink-0 text-zoom-muted" aria-label="Shared" />}
                        {!d.can_edit && <span className="shrink-0 rounded bg-zoom-surface px-1.5 text-[10px] font-bold text-zoom-muted">VIEW ONLY</span>}
                      </span>
                      <span className="block truncate text-xs text-zoom-muted">{d.snippet || "Empty document"}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-2 text-xs text-zoom-muted sm:flex">
                      <Avatar name={d.owner.name} color={d.owner.avatar_color} size={20} />
                      {d.is_owner ? "You" : d.owner.name}
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs text-zoom-muted">{edited(d.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function edited(iso: string): string {
  const d = new Date(iso);
  return isSameDay(d, new Date()) ? formatTime(iso) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function DocsPage() {
  return (
    <RequireAuth>
      <DocsHome />
    </RequireAuth>
  );
}
