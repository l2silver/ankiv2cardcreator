/**
 * Before `validateParsedJsonForBulkFromLlmDeck` / `buildBulkImportPayload`, attach `concept_id` on
 * concept branches that omit it (`ankiv2/backend` expects `concept_id` or `conceptId`).
 * Returns a deep-cloned JSON value; the input is not mutated.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deckLabelFromMap(m: Record<string, unknown>): string | null {
  const fromDeck = m.deck;
  if (typeof fromDeck === "string" && fromDeck.trim() !== "") {
    return fromDeck.trim();
  }
  const fromName = m.deckName;
  if (typeof fromName === "string" && fromName.trim() !== "") {
    return fromName.trim();
  }
  return null;
}

function isDeckBranchMap(m: Record<string, unknown>): boolean {
  const label = deckLabelFromMap(m);
  if (!label) return false;
  return Array.isArray(m.cards);
}

function isCardLeafMap(m: Record<string, unknown>): boolean {
  return typeof m.question === "string";
}

function truthyConceptFlag(v: unknown): boolean {
  if (v === true) return true;
  return typeof v === "string" && v.trim().toLowerCase() === "true";
}

function hasExplicitConceptId(m: Record<string, unknown>): boolean {
  const a = typeof m.concept_id === "string" ? m.concept_id.trim() : "";
  if (a) return true;
  const b = typeof m.conceptId === "string" ? m.conceptId.trim() : "";
  return !!b;
}

/** Same discriminant as Go `isConceptBranchMap`, except id may be missing. */
function isConceptBranchMissingId(m: Record<string, unknown>): boolean {
  if (isDeckBranchMap(m) || isCardLeafMap(m)) return false;
  if (!truthyConceptFlag(m.concept)) return false;
  if (!Array.isArray(m.cards)) return false;
  if (hasExplicitConceptId(m)) return false;
  return true;
}

function newConceptWireId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  throw new Error("crypto.randomUUID is not available; cannot assign concept_id");
}

function walk(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(walk);

  const src = v as Record<string, unknown>;
  const needsId = isConceptBranchMissingId(src);

  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    out[k] = walk(src[k]);
  }
  if (needsId) {
    out.concept_id = newConceptWireId();
  }
  return out;
}

/**
 * Deep-clone `parsed` and set `concept_id` on concept subtrees where both `concept_id` and `conceptId` are absent or blank.
 */
export function assignMissingConceptIds(parsed: unknown): unknown {
  return walk(parsed);
}
