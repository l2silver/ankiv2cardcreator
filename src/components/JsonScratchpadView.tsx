"use client";

import { useEffect, useState } from "react";

import { apiFetch, getDisplayApiBaseUrl } from "@/lib/api/client";
import { fetchDistinctDeckIds } from "@/lib/api/decks";
import { SearchableDeckPicker } from "@/components/SearchableDeckPicker";
import {
  buildBulkImportPayload,
  noteTypeFromParentDeckName,
  parentDeckSegment,
  validateParsedJsonForBulkFromLlmDeck,
} from "@/lib/llmDeck/validateBulkFromLlmDeckInput";

/**
 * Full-page JSON paste area (first “view” for card creator). A second view can be wired later.
 */
export function JsonScratchpadView() {
  const [raw, setRaw] = useState("");
  const [extraArrays, setExtraArrays] = useState<string[]>([]);
  const [deckName, setDeckName] = useState("");
  const [label, setLabel] = useState("");
  const [phase, setPhase] = useState<"idle" | "posting">("idle");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [schemaCheck, setSchemaCheck] = useState<
    | { kind: "idle" }
    | { kind: "bad-parse"; message: string }
    | { kind: "deck"; result: ReturnType<typeof validateParsedJsonForBulkFromLlmDeck> }
  >({ kind: "idle" });
  const [result, setResult] = useState<{
    migration_id: number;
    notes_upserted: number;
    affected_card_ids: string[];
    migration_label?: string;
  } | null>(null);

  const [deckOptions, setDeckOptions] = useState<string[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDecksLoading(true);
      setDecksError(null);
      try {
        const decks = await fetchDistinctDeckIds();
        if (!cancelled) setDeckOptions(decks);
      } catch (e) {
        if (!cancelled) {
          setDecksError(e instanceof Error ? e.message : "Could not load decks");
          setDeckOptions([]);
        }
      } finally {
        if (!cancelled) setDecksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const derivedNoteType =
    deckName.trim() !== "" ? noteTypeFromParentDeckName(parentDeckSegment(deckName)) : null;

  const parseConcatenatedInput = (): { parsed: unknown } | { error: string } => {
    const chunks = [raw, ...extraArrays].map((s) => s.trim()).filter(Boolean);
    if (chunks.length === 0) {
      return { error: "JSON input is empty" };
    }
    if (chunks.length === 1) {
      try {
        return { parsed: JSON.parse(chunks[0]) as unknown };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Invalid JSON" };
      }
    }

    const merged: unknown[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let v: unknown;
      try {
        v = JSON.parse(chunks[i]) as unknown;
      } catch (e) {
        return { error: `Array ${i + 1}: ${e instanceof Error ? e.message : "Invalid JSON"}` };
      }
      if (!Array.isArray(v)) {
        return { error: `Array ${i + 1}: expected a JSON array of notes` };
      }
      merged.push(...v);
    }
    return { parsed: merged };
  };

  const runSchemaValidation = () => {
    setRequestError(null);
    const r = parseConcatenatedInput();
    if ("error" in r) {
      setSchemaCheck({ kind: "bad-parse", message: r.error });
      return;
    }
    setSchemaCheck({
      kind: "deck",
      result: validateParsedJsonForBulkFromLlmDeck(r.parsed, { notesDeckName: deckName }),
    });
  };

  const handleImport = async () => {
    setRequestError(null);
    setResult(null);

    const r = parseConcatenatedInput();
    if ("error" in r) {
      setSchemaCheck({ kind: "bad-parse", message: r.error });
      return;
    }

    const deckValidation = validateParsedJsonForBulkFromLlmDeck(r.parsed, { notesDeckName: deckName });
    setSchemaCheck({ kind: "deck", result: deckValidation });
    if (!deckValidation.ok) {
      return;
    }

    const payload = buildBulkImportPayload(r.parsed, deckName, label);

    setPhase("posting");
    try {
      const res = await apiFetch("/cards/bulk-from-llm-deck", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        setRequestError(text || `Request failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as {
        migration_id: number;
        notes_upserted: number;
        affected_card_ids: string[];
        migration_label?: string;
      };
      setResult(json);
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPhase("idle");
    }
  };

  const schemaErrors: string[] =
    schemaCheck.kind === "bad-parse"
      ? [schemaCheck.message]
      : schemaCheck.kind === "deck" && !schemaCheck.result.ok
        ? schemaCheck.result.errors
        : [];

  const schemaWarnings: string[] =
    schemaCheck.kind === "deck" ? schemaCheck.result.warnings : [];

  const schemaOk =
    schemaCheck.kind === "deck" && schemaCheck.result.ok ? schemaCheck.result : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-950 text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Bulk import from LLM deck</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              POST <code className="text-zinc-400">/cards/bulk-from-llm-deck</code>
              {getDisplayApiBaseUrl() ? (
                <>
                  {" "}
                  against <code className="text-zinc-400">{getDisplayApiBaseUrl()}</code>
                </>
              ) : null}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
              Paste a JSON <span className="text-zinc-400">array of notes</span>, set the deck name, then
              Import. <code className="text-zinc-500">noteType</code> is chosen from the parent segment of the
              deck path (before <code className="text-zinc-500">::</code>): <code className="text-zinc-500">vocab</code>
              , <code className="text-zinc-500">knowledge</code>, <code className="text-zinc-500">french</code> →
              language; otherwise language. You can still paste a full deck object instead of an array.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="migration label (optional)"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 sm:w-64"
              aria-label="Migration label"
            />
            <button
              type="button"
              onClick={runSchemaValidation}
              disabled={phase === "posting"}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Validate
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={phase === "posting"}
              className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "posting" ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
      </header>
      <div className="shrink-0 space-y-3 border-b border-zinc-800 bg-zinc-900/40 px-4 py-3">
        {decksError ? (
          <p className="text-xs text-amber-300/90">
            Could not load deck list: <span className="font-mono text-amber-200/90">{decksError}</span>
          </p>
        ) : null}
        <SearchableDeckPicker
          decks={deckOptions}
          disabled={decksLoading}
          loading={decksLoading}
          onPick={(d) => {
            setDeckName(d);
            setSchemaCheck({ kind: "idle" });
            setRequestError(null);
          }}
        />
        <label htmlFor="cardcreator-deck-name" className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Deck name (Anki-style path)
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="cardcreator-deck-name"
            value={deckName}
            onChange={(e) => {
              setDeckName(e.target.value);
              setSchemaCheck({ kind: "idle" });
              setRequestError(null);
            }}
            placeholder="e.g. French::Verbs or Knowledge::Chapter1"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 sm:flex-1"
            autoComplete="off"
          />
          <div className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400 sm:min-w-[11rem]">
            {derivedNoteType ? (
              <>
                <span className="text-zinc-500">noteType</span>{" "}
                <code className="text-sky-300">{derivedNoteType}</code>
              </>
            ) : (
              <span className="text-zinc-600">Enter a deck name to see noteType</span>
            )}
          </div>
        </div>
      </div>
      {schemaOk ? (
        <div className="shrink-0 border-b border-zinc-800 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-200">
          Schema OK — {schemaOk.cardCount} card{schemaOk.cardCount === 1 ? "" : "s"} would be sent to the
          importer (matches server <code className="text-emerald-300/90">FlattenLlmDeckJSON</code> rules).
        </div>
      ) : null}
      {schemaErrors.length > 0 ? (
        <div className="shrink-0 border-b border-zinc-800 bg-red-950/40 px-4 py-2 text-xs text-red-200">
          <p className="font-medium text-red-100">Schema / shape errors</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {schemaErrors.map((line, i) => (
              <li key={i} className="font-mono">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {schemaWarnings.length > 0 ? (
        <div className="shrink-0 border-b border-zinc-800 bg-amber-950/25 px-4 py-2 text-xs text-amber-200/90">
          <p className="font-medium text-amber-100">Warnings (server may skip some rows)</p>
          <ul className="mt-1 max-h-28 list-inside list-disc space-y-0.5 overflow-y-auto">
            {schemaWarnings.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {requestError ? (
        <div className="shrink-0 border-b border-zinc-800 bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
          {requestError}
        </div>
      ) : null}
      {result ? (
        <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-300">
          <span className="text-zinc-500">migration_id</span>{" "}
          <span className="font-mono text-zinc-200">{result.migration_id}</span>
          <span className="mx-2 text-zinc-700">·</span>
          <span className="text-zinc-500">notes_upserted</span>{" "}
          <span className="font-mono text-zinc-200">{result.notes_upserted}</span>
          <span className="mx-2 text-zinc-700">·</span>
          <span className="text-zinc-500">affected_card_ids</span>{" "}
          <span className="font-mono text-zinc-200">{result.affected_card_ids?.length ?? 0}</span>
          {result.migration_label ? (
            <>
              <span className="mx-2 text-zinc-700">·</span>
              <span className="text-zinc-500">label</span>{" "}
              <span className="font-mono text-zinc-200">{result.migration_label}</span>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes arrays</p>
          <button
            type="button"
            onClick={() => setExtraArrays((a) => [...a, ""])}
            disabled={phase === "posting"}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add another array
          </button>
        </div>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setSchemaCheck({ kind: "idle" });
            setRequestError(null);
          }}
          spellCheck={false}
          className="min-h-0 w-full flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 font-mono text-sm leading-relaxed text-zinc-100 caret-sky-400 outline-none ring-0 focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
          placeholder={`[\n  {\n    \"id\": \"…\",\n    \"question\": \"…\",\n    \"answer\": \"…\",\n    \"context\": \"\",\n    \"moreQuestions\": []\n  }\n]`}
          aria-label="JSON input"
        />
        {extraArrays.map((val, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">Extra array {idx + 2}</p>
              <button
                type="button"
                disabled={phase === "posting"}
                onClick={() => {
                  setExtraArrays((a) => a.filter((_, i) => i !== idx));
                  setSchemaCheck({ kind: "idle" });
                  setRequestError(null);
                }}
                className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>
            <textarea
              value={val}
              onChange={(e) => {
                const next = e.target.value;
                setExtraArrays((a) => a.map((s, i) => (i === idx ? next : s)));
                setSchemaCheck({ kind: "idle" });
                setRequestError(null);
              }}
              spellCheck={false}
              className="h-40 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 font-mono text-sm leading-relaxed text-zinc-100 caret-sky-400 outline-none ring-0 focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              placeholder="Paste another JSON array of notes here…"
              aria-label={`Extra JSON array ${idx + 2}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
