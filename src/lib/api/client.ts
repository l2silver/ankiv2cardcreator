import {
  hasCompletedBrowserSetup,
  readStoredApiKey,
  readStoredApiUrl,
} from "@/lib/settings/apiCredentials";

function resolvedBaseUrl(): string | undefined {
  if (typeof window !== "undefined") {
    const stored = readStoredApiUrl()?.trim().replace(/\/$/, "") ?? "";
    if (stored) return stored;
  }
  const env = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";
  return env || undefined;
}

function getBaseUrl(): string {
  const base = resolvedBaseUrl();
  if (!base) {
    throw new Error("API base URL is not set (first-run setup or NEXT_PUBLIC_API_URL)");
  }
  return base;
}

/** Both set at build time — skip first-run setup and use env only. */
export function hasFullBuildTimeApiConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_API_URL?.trim() && process.env.NEXT_PUBLIC_API_KEY?.trim(),
  );
}

/** For status UI: env wins, else stored origin. */
export function getDisplayApiBaseUrl(): string | null {
  const r = resolvedBaseUrl();
  return r ?? null;
}

/**
 * API key for `Authorization: Bearer …`.
 * Build-time `NEXT_PUBLIC_API_KEY` wins if set; otherwise localStorage after first-run setup (`ankiv2_api_key`).
 */
export function getResolvedApiKey(): string | undefined {
  const envKey = process.env.NEXT_PUBLIC_API_KEY?.trim();
  if (envKey) return envKey;
  if (typeof window === "undefined") return undefined;
  if (!hasCompletedBrowserSetup()) return undefined;
  const stored = readStoredApiKey();
  if (stored === null) return undefined;
  const t = stored.trim();
  return t || undefined;
}

const E2E_QUERY = "ankiv2_e2e";
const E2E_SESSION_KEY = "ankiv2_e2e";

function shouldSendAnkiv2TestModeHeader(): boolean {
  if (process.env.NEXT_PUBLIC_ANKIV2_E2E === "1") {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const q = new URLSearchParams(window.location.search).get(E2E_QUERY);
    if (q === "1") {
      sessionStorage.setItem(E2E_SESSION_KEY, "1");
    }
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(E2E_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getBaseUrl();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (shouldSendAnkiv2TestModeHeader()) {
    headers.set("X-Ankiv2-Test-Mode", "1");
  }
  const key = getResolvedApiKey();
  if (key) {
    headers.set("Authorization", `Bearer ${key}`);
  }
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, headers });
}

/** True when the app has a backend base URL (build-time env or localStorage after setup). */
export function isApiConfigured(): boolean {
  return Boolean(resolvedBaseUrl());
}

/**
 * True when requests can run: base URL is set and either the build supplies
 * `NEXT_PUBLIC_API_KEY` or the user finished the first-run API key screen.
 */
export function isApiReadyForRequests(): boolean {
  if (!isApiConfigured()) return false;
  if (process.env.NEXT_PUBLIC_API_KEY?.trim()) return true;
  if (typeof window === "undefined") return false;
  return hasCompletedBrowserSetup();
}
