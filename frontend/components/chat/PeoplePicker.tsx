"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import type { Person } from "@/lib/types";

interface Props {
  selected: Person[];
  onChange: (people: Person[]) => void;
  /** Pick just one person (for direct messages). */
  single?: boolean;
  /** People who can't be picked (for example, yourself or existing members). */
  excludeIds?: number[];
}

/** Search people with an account by name or email and pick them. */
export default function PeoplePicker({ selected, onChange, single, excludeIds = [] }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  // Search as you type, waiting for a short pause.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      api
        .searchPeople(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const hidden = new Set([...excludeIds, ...selected.map((p) => p.id)]);
  const visible = results.filter((p) => !hidden.has(p.id));

  const pick = (p: Person) => {
    onChange(single ? [p] : [...selected, p]);
    setQuery("");
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-zoom-blue-light py-0.5 pl-1 pr-2 text-sm text-zoom-blue">
              <Avatar name={p.name} color={p.avatar_color} size={20} />
              {p.name}
              <button onClick={() => onChange(selected.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {!(single && selected.length) && (
        <label className="flex items-center gap-2 rounded-lg border border-zoom-border px-3 py-2 text-sm focus-within:border-zoom-blue">
          <Search className="h-4 w-4 text-zoom-muted" />
          <input
            className="w-full bg-transparent outline-none placeholder:text-zoom-muted"
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search people"
            autoFocus
          />
          {searching && <Spinner className="h-3.5 w-3.5 text-zoom-muted" />}
        </label>
      )}
      {query.trim() && !searching && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-zoom-border">
          {visible.length === 0 && <li className="px-3 py-2 text-sm text-zoom-muted">No one found</li>}
          {visible.map((p) => (
            <li key={p.id}>
              <button onClick={() => pick(p)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-zoom-surface">
                <Avatar name={p.name} color={p.avatar_color} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-zoom-muted">{p.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
