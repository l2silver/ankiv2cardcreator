"use client";

import { useEffect, useState } from "react";

import { ApiKeySetup } from "@/components/ApiKeySetup";
import { hasFullBuildTimeApiConfig } from "@/lib/api/client";
import {
  ANKIV2_STORAGE_SETUP_DONE,
  readStoredApiUrl,
} from "@/lib/settings/apiCredentials";

function hasResolvedApiUrl(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL?.trim() || readStoredApiUrl()?.trim());
}

/**
 * First visit: show API URL + key setup unless both `NEXT_PUBLIC_API_URL` and
 * `NEXT_PUBLIC_API_KEY` are set at build time (CI / hosted bundles).
 */
export function ApiAppGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"loading" | "setup" | "app">("loading");

  useEffect(() => {
    queueMicrotask(() => {
      if (hasFullBuildTimeApiConfig()) {
        setPhase("app");
        return;
      }
      try {
        const done = localStorage.getItem(ANKIV2_STORAGE_SETUP_DONE) === "1";
        const urlOk = hasResolvedApiUrl();
        setPhase(done && urlOk ? "app" : "setup");
      } catch {
        setPhase("setup");
      }
    });
  }, []);

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (phase === "setup") {
    return <ApiKeySetup onComplete={() => setPhase("app")} />;
  }

  return <div className="flex min-h-screen flex-1 flex-col">{children}</div>;
}
