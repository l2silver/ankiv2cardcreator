/**
 * Browser localStorage keys for API credentials (aligned with `ankiv2/web`).
 *
 * - `ankiv2_setup_done` — user completed the first-run screen (`"1"`).
 * - `ankiv2_api_url` — Go API origin (e.g. `http://localhost:8080`), no trailing slash.
 * - `ankiv2_api_key` — Bearer token for the Go API (may be empty if the server has no `API_KEY`).
 */

export const ANKIV2_STORAGE_SETUP_DONE = "ankiv2_setup_done";
export const ANKIV2_STORAGE_API_URL = "ankiv2_api_url";
export const ANKIV2_STORAGE_API_KEY = "ankiv2_api_key";

/** Normalize user input to an origin; throws if empty or not http(s). */
export function normalizeApiBaseUrl(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error("API URL is required");
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    u = new URL(`http://${t}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("URL must use http or https");
  }
  return u.origin.replace(/\/$/, "");
}

export function readStoredApiUrl(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ANKIV2_STORAGE_API_URL);
  return v === null ? null : v;
}

export function readStoredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ANKIV2_STORAGE_API_KEY);
  return v === null ? null : v;
}

export function writeStoredCredentials(apiBaseUrl: string, apiKey: string): void {
  localStorage.setItem(ANKIV2_STORAGE_API_URL, apiBaseUrl);
  localStorage.setItem(ANKIV2_STORAGE_API_KEY, apiKey);
  localStorage.setItem(ANKIV2_STORAGE_SETUP_DONE, "1");
}

export function clearStoredCredentials(): void {
  localStorage.removeItem(ANKIV2_STORAGE_API_URL);
  localStorage.removeItem(ANKIV2_STORAGE_API_KEY);
  localStorage.removeItem(ANKIV2_STORAGE_SETUP_DONE);
}

export function hasCompletedBrowserSetup(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ANKIV2_STORAGE_SETUP_DONE) === "1";
}
