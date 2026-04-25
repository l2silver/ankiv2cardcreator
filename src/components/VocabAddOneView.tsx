"use client";

import Link from "next/link";
import { useState } from "react";

import { getDisplayApiBaseUrl } from "@/lib/api/client";
import { postVocabAddOne } from "@/lib/api/vocabAddOne";

export function VocabAddOneView() {
  const [word, setWord] = useState("");
  const [phase, setPhase] = useState<"idle" | "posting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof postVocabAddOne>> | null>(null);

  const submit = async () => {
    const w = word.trim();
    if (!w) return;
    setError(null);
    setResult(null);
    setPhase("posting");
    try {
      const r = await postVocabAddOne(w);
      setResult(r);
      setWord("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPhase("idle");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-950 text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Add one vocab word</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              POST <code className="text-zinc-400">/cards/vocab-add-one</code> into{" "}
              <code className="text-zinc-400">2avocab</code>
              {getDisplayApiBaseUrl() ? (
                <>
                  {" "}
                  against <code className="text-zinc-400">{getDisplayApiBaseUrl()}</code>
                </>
              ) : null}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
              Type a single word, the server calls Gemini, then forwards the generated note through the normal bulk
              import pipeline.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-900"
            >
              Back
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="max-w-xl">
          <label
            htmlFor="vocab-add-one-word"
            className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Word
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="vocab-add-one-word"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="e.g. obstinate"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              aria-label="Vocab word"
              disabled={phase === "posting"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={phase === "posting" || word.trim() === ""}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "posting" ? "Adding…" : "Add"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="max-w-3xl rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="max-w-3xl rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
            <div>
              Added <span className="font-mono">{result.word}</span> →{" "}
              <span className="font-mono">{result.deck_id}</span>
            </div>
            <div className="mt-1 text-emerald-200/80">
              migration_id: <span className="font-mono">{result.migration_id}</span>, notes_upserted:{" "}
              <span className="font-mono">{result.notes_upserted}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

