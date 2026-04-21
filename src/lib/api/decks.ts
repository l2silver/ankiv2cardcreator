import { apiFetch } from "@/lib/api/client";

export type DecksListResponse = {
  decks: string[];
};

export async function fetchDistinctDeckIds(): Promise<string[]> {
  const res = await apiFetch("/decks");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `GET /decks failed (${res.status})`);
  }
  const body = (await res.json()) as DecksListResponse;
  return Array.isArray(body.decks) ? body.decks : [];
}
