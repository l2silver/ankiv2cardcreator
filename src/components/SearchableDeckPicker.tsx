"use client";

import { useMemo, useState } from "react";

type Props = {
  decks: string[];
  onPick: (deckId: string) => void;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * Searchable list of server `deck_id` values; choosing one fills the editable deck name field (parent-owned).
 */
export function SearchableDeckPicker({ decks, onPick, disabled, loading }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return decks;
    return decks.filter((d) => d.toLowerCase().includes(t));
  }, [decks, query]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Existing decks</p>
        <button
          type="button"
          disabled={disabled || decks.length === 0}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {open ? "Hide" : "Show"} list
        </button>
      </div>
      {loading ? <p className="mt-2 text-xs text-zinc-500">Loading deck list…</p> : null}
      {!loading && decks.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">No decks found in the collection yet.</p>
      ) : null}
      {open ? (
        <div className="mt-2 space-y-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deck paths…"
            disabled={disabled}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            aria-label="Search existing decks"
          />
          <ul
            className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/40 py-1 text-sm"
            role="listbox"
            aria-label="Deck list"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-zinc-500">No matches.</li>
            ) : (
              filtered.map((d) => (
                <li key={d}>
                  <button
                    type="button"
                    disabled={disabled}
                    className="w-full px-3 py-1.5 text-left font-mono text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                    onClick={() => {
                      onPick(d);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    {d}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
