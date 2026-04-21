"use client";

import { useState } from "react";

import { normalizeApiBaseUrl, writeStoredCredentials } from "@/lib/settings/apiCredentials";

type Props = {
  onComplete: () => void;
};

/**
 * First-run screen: collect API base URL and API key, persist to localStorage.
 * URL is required. Empty key is allowed when the Go server has no `API_KEY` configured.
 */
export function ApiKeySetup({ onComplete }: Props) {
  const [apiUrl, setApiUrl] = useState(() => process.env.NEXT_PUBLIC_API_URL?.trim() ?? "");
  const [apiKey, setApiKey] = useState(() => process.env.NEXT_PUBLIC_API_KEY?.trim() ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let origin: string;
    try {
      origin = normalizeApiBaseUrl(apiUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid API URL");
      return;
    }
    try {
      writeStoredCredentials(origin, apiKey.trim());
      onComplete();
    } catch {
      setError("Could not save settings. Is local storage available?");
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
        <h1 className="text-lg font-semibold tracking-tight">Anki2 Card Creator</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Enter your Go backend&apos;s base URL (no path; e.g.{" "}
          <code className="text-zinc-500">http://localhost:8080</code>) and the same API key as the
          server&apos;s <code className="text-zinc-500">API_KEY</code> (sent as{" "}
          <code className="text-zinc-500">Authorization: Bearer …</code>). Both are stored only in this
          browser&apos;s <strong className="text-zinc-300">local storage</strong> (same keys as the main
          Anki2 web app).
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Leave the API key empty only if your server has no API key configured.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="ankiv2-api-url" className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              API base URL
            </label>
            <input
              id="ankiv2-api-url"
              name="apiUrl"
              type="url"
              autoComplete="url"
              value={apiUrl}
              onChange={(ev) => setApiUrl(ev.target.value)}
              placeholder="http://localhost:8080"
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>
          <div>
            <label htmlFor="ankiv2-api-key" className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              API key
            </label>
            <input
              id="ankiv2-api-key"
              name="apiKey"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(ev) => setApiKey(ev.target.value)}
              placeholder="Paste your API key (optional if server has no key)"
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>
          {error ? <p className="text-sm text-amber-400">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
