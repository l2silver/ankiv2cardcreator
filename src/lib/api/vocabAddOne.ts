import { apiFetch } from "@/lib/api/client";

export type VocabAddOneResponse = {
  deck_id: string;
  word: string;
  migration_id: number;
  notes_upserted: number;
  affected_card_ids: string[];
  note_base_ids: string[];
};

export async function postVocabAddOne(word: string): Promise<VocabAddOneResponse> {
  const res = await apiFetch("/cards/vocab-add-one", {
    method: "POST",
    body: JSON.stringify({ word }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `POST /cards/vocab-add-one failed (${res.status})`);
  }
  return (await res.json()) as VocabAddOneResponse;
}

