"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import { apiFetch, getDisplayApiBaseUrl } from "@/lib/api/client";

type GemCard = {
  question: string;
  answer: string;
  context: string;
  deck: string;
};

const PARENT_DECK = "French3";

const ALLOWED_SUBDECKS = [
  "Adjectives",
  "Adverb",
  "Aux Verbs",
  "Conjugations",
  "Conjunctions",
  "Gerunds",
  "Interrogative",
  "Nouns",
  "Participles",
  "Prepositions",
  "Promenol Verbs",
  "Pronouns",
  "Pronunciation",
  "Rules",
  "Sayings",
  "Verbs",
] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateGemCards(parsed: unknown): { ok: true; cards: GemCard[]; warnings: string[] } | { ok: false; errors: string[] } {
  if (!Array.isArray(parsed)) {
    return { ok: false, errors: ["Expected a JSON array of cards."] };
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  const out: GemCard[] = [];
  parsed.forEach((row, idx) => {
    const path = `cards[${idx}]`;
    if (!isPlainObject(row)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    const q = row.question;
    const a = row.answer;
    const c = row.context;
    const d = row.deck;
    if (typeof q !== "string" || q.trim() === "") errors.push(`${path}.question: required string`);
    if (typeof a !== "string" || a.trim() === "") errors.push(`${path}.answer: required string`);
    if (typeof c !== "string") errors.push(`${path}.context: must be a string (can be empty)`);
    if (typeof d !== "string" || d.trim() === "") errors.push(`${path}.deck: required string`);
    if (typeof d === "string" && d.trim() !== "" && !ALLOWED_SUBDECKS.includes(d.trim() as any)) {
      errors.push(`${path}.deck: must be one of ${ALLOWED_SUBDECKS.map((s) => JSON.stringify(s)).join(", ")}`);
    }
    if (typeof q === "string" && q.length > 500) warnings.push(`${path}.question: very long (${q.length})`);
    if (typeof a === "string" && a.length > 500) warnings.push(`${path}.answer: very long (${a.length})`);
    if (typeof c === "string" && c.length > 2000) warnings.push(`${path}.context: very long (${c.length})`);

    if (errors.length === 0 || errors[errors.length - 1]?.startsWith(path) === false) {
      // no-op (keeps TS happy); real push happens only when no per-row errors detected below
    }

    if (
      typeof q === "string" &&
      typeof a === "string" &&
      typeof c === "string" &&
      typeof d === "string" &&
      q.trim() !== "" &&
      a.trim() !== "" &&
      d.trim() !== "" &&
      ALLOWED_SUBDECKS.includes(d.trim() as any)
    ) {
      out.push({ question: q, answer: a, context: c, deck: d.trim() });
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (out.length === 0) {
    return { ok: false, errors: ["No valid cards found in the array."] };
  }
  return { ok: true, cards: out, warnings };
}

function buildDeckTreePayload(cards: GemCard[], parentDeckName: string) {
  const dn = parentDeckName.trim();
  if (!dn) throw new Error("Parent deck name is required.");

  const byDeck = new Map<string, GemCard[]>();
  for (const c of cards) {
    const k = c.deck.trim();
    const arr = byDeck.get(k);
    if (arr) arr.push(c);
    else byDeck.set(k, [c]);
  }

  const branches = Array.from(byDeck.entries()).map(([subdeck, rows]) => ({
    deck: subdeck,
    cards: rows.map((r) => ({
      question: r.question,
      answer: r.answer,
      context: r.context,
    })),
  }));

  return {
    deck: {
      deck: dn,
      noteType: "language",
      cards: branches,
    },
  };
}

export function GemImportView() {
  const [raw, setRaw] = useState("");
  const [label, setLabel] = useState("gem");
  const [phase, setPhase] = useState<"idle" | "posting">("idle");
  const [schema, setSchema] = useState<
    | { kind: "idle" }
    | { kind: "bad-parse"; message: string }
    | { kind: "validated"; ok: true; cardCount: number; warnings: string[] }
    | { kind: "validated"; ok: false; errors: string[] }
  >({ kind: "idle" });
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    migration_id: number;
    notes_upserted: number;
    affected_card_ids: string[];
    migration_label?: string;
  } | null>(null);

  const apiBase = getDisplayApiBaseUrl();

  const parsed = useMemo(() => {
    const t = raw.trim();
    if (!t) return { kind: "empty" as const };
    try {
      return { kind: "ok" as const, value: JSON.parse(t) as unknown };
    } catch (e) {
      return { kind: "err" as const, message: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }, [raw]);

  const validate = () => {
    setRequestError(null);
    setResult(null);
    if (parsed.kind === "empty") {
      setSchema({ kind: "validated", ok: false, errors: ["JSON input is empty."] });
      return;
    }
    if (parsed.kind === "err") {
      setSchema({ kind: "bad-parse", message: parsed.message });
      return;
    }
    const r = validateGemCards(parsed.value);
    if (!r.ok) {
      setSchema({ kind: "validated", ok: false, errors: r.errors });
      return;
    }
    setSchema({ kind: "validated", ok: true, cardCount: r.cards.length, warnings: r.warnings });
  };

  const handleImport = async () => {
    setRequestError(null);
    setResult(null);
    if (parsed.kind !== "ok") {
      validate();
      return;
    }

    const v = validateGemCards(parsed.value);
    if (!v.ok) {
      setSchema({ kind: "validated", ok: false, errors: v.errors });
      return;
    }

    let payload: unknown;
    try {
      payload = buildDeckTreePayload(v.cards, PARENT_DECK);
      const tLabel = label.trim();
      if (tLabel) {
        payload = { ...(payload as any), migration_label: tLabel };
      }
    } catch (e) {
      setSchema({
        kind: "validated",
        ok: false,
        errors: [e instanceof Error ? e.message : "Could not build payload"],
      });
      return;
    }

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
      setRaw("");
      setSchema({ kind: "idle" });
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPhase("idle");
    }
  };

  const schemaErrors =
    schema.kind === "bad-parse"
      ? [schema.message]
      : schema.kind === "validated" && !schema.ok
        ? schema.errors
        : [];
  const schemaWarnings = schema.kind === "validated" && schema.ok ? schema.warnings : [];
  const schemaOkCount = schema.kind === "validated" && schema.ok ? schema.cardCount : null;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Import Gemini French cards</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              Paste the JSON array produced by your gem prompt (cards include{" "}
              <code className="text-zinc-400">deck</code>), then submit as an LLM deck tree to{" "}
              <code className="text-zinc-400">/cards/bulk-from-llm-deck</code>
              {apiBase ? (
                <>
                  {" "}
                  against <code className="text-zinc-400">{apiBase}</code>
                </>
              ) : null}
              . This view always imports into <code className="text-zinc-400">{PARENT_DECK}</code>.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
            >
              Back
            </Link>
          </div>
        </div>
      </header>

      {schemaOkCount !== null ? (
        <div className="shrink-0 border-b border-zinc-800 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-200">
          Schema OK — {schemaOkCount} card{schemaOkCount === 1 ? "" : "s"} will be grouped into subdecks.
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
          <p className="font-medium text-amber-100">Warnings</p>
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

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Parent deck</label>
            <div className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              <code className="text-sky-300">{PARENT_DECK}</code>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Subdecks come from each card’s <code className="text-zinc-400">deck</code> field (e.g.{" "}
              <code className="text-zinc-400">Nouns</code>, <code className="text-zinc-400">Verbs</code>). This view always
              sends <code className="text-zinc-400">noteType</code> <code className="text-zinc-400">language</code>.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Migration label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="optional"
              className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              aria-label="Migration label"
              autoComplete="off"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={validate}
                disabled={phase === "posting"}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Validate
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={phase === "posting"}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {phase === "posting" ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>

        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setSchema({ kind: "idle" });
            setRequestError(null);
          }}
          spellCheck={false}
          className="min-h-0 w-full flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 font-mono text-sm leading-relaxed text-zinc-100 caret-sky-400 outline-none ring-0 focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
          placeholder={`[\n  {\n    \"question\": \"…\",\n    \"answer\": \"…\",\n    \"context\": \"…\",\n    \"deck\": \"Nouns\"\n  }\n]`}
          aria-label="Gem JSON input"
        />
      </main>
    </div>
  );
}

