/**
 * Client-side validation aligned with Go `FlattenLlmDeckJSON` + `moreQuestionsWireFromCard`
 * (`ankiv2/backend/internal/store/bulk_llm_deck.go`). Same envelope rule as the HTTP handler:
 * if the body has a `deck` object, only that subtree is passed to flatten.
 */

export type LlmDeckValidationResult =
  | { ok: true; cardCount: number; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * First path segment of an Anki-style `deck_id` / deck name (before `::`), lowercased.
 * Matches how the server uses the root label in nested deck trees (`bulk_llm_deck.go`).
 */
export function parentDeckSegment(deckName: string): string {
  const t = deckName.trim();
  if (!t) return "";
  const i = t.indexOf("::");
  if (i === -1) return t.toLowerCase();
  return t.slice(0, i).trim().toLowerCase();
}

/**
 * Wire `note_type` for a flat deck built from notes + `deckName`, aligned with
 * `canonicalNoteType` in `ankiv2/backend/internal/store/note_variants.go` for common roots.
 */
export function noteTypeFromParentDeckName(parentSegment: string): string {
  const p = parentSegment.trim().toLowerCase();
  switch (p) {
    case "vocab":
      return "vocab";
    case "knowledge":
      return "knowledge";
    case "basic":
      return "basic";
    case "french":
      return "language";
    default:
      return "language";
  }
}

/** Build the `deckName` + `noteType` + `cards` object the Go `FlattenLlmDeckJSON` deckName branch expects. */
export function wrapNotesArrayToDeckPayload(cards: unknown[], deckName: string): Record<string, unknown> {
  const dn = deckName.trim();
  if (!dn) {
    throw new Error("deckName is required");
  }
  if (!Array.isArray(cards)) {
    throw new Error("notes must be a JSON array");
  }
  const noteType = noteTypeFromParentDeckName(parentDeckSegment(dn));
  return { deckName: dn, noteType, cards };
}

/**
 * Request body for `POST /cards/bulk-from-llm-deck`: either a wrapped notes array + optional label,
 * or legacy full deck JSON (optionally with `{ deck, migration_label }`).
 */
export function buildBulkImportPayload(
  parsed: unknown,
  notesDeckName: string,
  migrationLabel: string,
): unknown {
  const tLabel = migrationLabel.trim();
  if (Array.isArray(parsed)) {
    const inner = wrapNotesArrayToDeckPayload(parsed, notesDeckName);
    return tLabel ? { deck: inner, migration_label: tLabel } : inner;
  }
  let payload: unknown = parsed;
  if (tLabel) {
    if (isPlainObject(parsed) && "deck" in parsed) {
      payload = { ...(parsed as Record<string, unknown>), migration_label: tLabel };
    } else {
      payload = { deck: parsed, migration_label: tLabel };
    }
  }
  return payload;
}

/**
 * Same extraction as the server: inner `deck` when it is a non-null object; otherwise the whole root.
 */
export function extractDeckObjectForFlatten(parsed: unknown): Record<string, unknown> {
  if (!isPlainObject(parsed)) {
    throw new Error("JSON must be a single object (not an array or primitive)");
  }
  if ("deck" in parsed) {
    const d = parsed.deck;
    if (d === null || d === undefined) {
      throw new Error("`deck` is present but null — remove the key or set it to the deck object");
    }
    if (!isPlainObject(d)) {
      throw new Error("`deck` must be an object (the LLM deck subtree)");
    }
    return d;
  }
  return parsed;
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

function validateMoreQuestionsOnCard(card: Record<string, unknown>, path: string): string[] {
  const hasMq = "moreQuestions" in card;
  const hasSnake = "more_questions" in card;
  const raw = hasMq ? card.moreQuestions : hasSnake ? card.more_questions : undefined;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    return [`${path}: moreQuestions / more_questions must be an array`];
  }
  const errs: string[] = [];
  raw.forEach((el, i) => {
    if (!isPlainObject(el)) {
      errs.push(`${path} moreQuestions[${i}]: each entry must be an object (invalid entries are skipped on the server)`);
    }
  });
  return errs;
}

function noteTypeFromBranch(branch: Record<string, unknown>, inherited: string): string {
  let nt = inherited;
  if (typeof branch.noteType === "string" && branch.noteType.trim() !== "") {
    nt = branch.noteType.trim();
  } else if (typeof branch.note_type === "string" && branch.note_type.trim() !== "") {
    nt = branch.note_type.trim();
  }
  return nt;
}

function walkDeckBranch(
  branch: Record<string, unknown>,
  parent: string[],
  treeNoteType: string,
  out: { path: string; card: Record<string, unknown> }[],
  warnings: string[],
): void {
  const label = deckLabelFromMap(branch) ?? "";
  const segments = [...parent, label].filter((s) => s.trim() !== "");
  const deckPath = segments.join("::");

  const nt = noteTypeFromBranch(branch, treeNoteType);
  const cards = branch.cards;
  if (!Array.isArray(cards)) return;

  cards.forEach((item, idx) => {
    const path = `${deckPath || "(root)"} → cards[${idx}]`;
    if (!isPlainObject(item)) {
      warnings.push(`${path}: skipped — not an object`);
      return;
    }
    if (isDeckBranchMap(item)) {
      walkDeckBranch(item, segments, nt, out, warnings);
      return;
    }
    if (isCardLeafMap(item)) {
      out.push({ path, card: item });
      return;
    }
    warnings.push(
      `${path}: skipped — not a card leaf (need string "question") and not a deck branch (need deck/deckName + cards)`,
    );
  });
}

/**
 * Validates the same JSON shape the server flattens (after optional `{ deck }` unwrap).
 */
export function validateLlmDeckForBulkImport(deckObj: Record<string, unknown>): LlmDeckValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const deckName = typeof deckObj.deckName === "string" ? deckObj.deckName.trim() : "";
  if (deckName !== "") {
    if (!Array.isArray(deckObj.cards)) {
      return { ok: false, errors: ["deckName form requires cards array"], warnings };
    }

    const rows: { path: string; card: Record<string, unknown> }[] = [];
    deckObj.cards.forEach((item, idx) => {
      const path = `${deckName} → cards[${idx}]`;
      if (!isPlainObject(item)) {
        warnings.push(`${path}: skipped — not an object`);
        return;
      }
      if (!isCardLeafMap(item)) {
        warnings.push(`${path}: skipped — card leaf requires string field "question"`);
        return;
      }
      rows.push({ path, card: item });
    });

    for (const { path, card } of rows) {
      errors.push(...validateMoreQuestionsOnCard(card, path));
    }
    if (errors.length > 0) {
      return { ok: false, errors, warnings };
    }
    if (rows.length === 0) {
      return { ok: false, errors: ["no valid cards under deckName"], warnings };
    }
    return { ok: true, cardCount: rows.length, warnings };
  }

  const deckStr = typeof deckObj.deck === "string" ? deckObj.deck.trim() : "";
  if (deckStr !== "") {
    if (!Array.isArray(deckObj.cards)) {
      return { ok: false, errors: ["deck tree requires cards array"], warnings };
    }
    const nt =
      typeof deckObj.noteType === "string" && deckObj.noteType.trim() !== ""
        ? deckObj.noteType.trim()
        : typeof deckObj.note_type === "string" && deckObj.note_type.trim() !== ""
          ? deckObj.note_type.trim()
          : "";

    const rows: { path: string; card: Record<string, unknown> }[] = [];
    walkDeckBranch(deckObj, [], nt, rows, warnings);

    for (const { path, card } of rows) {
      errors.push(...validateMoreQuestionsOnCard(card, path));
    }
    if (errors.length > 0) {
      return { ok: false, errors, warnings };
    }
    if (rows.length === 0) {
      return { ok: false, errors: ["no valid cards in deck tree"], warnings };
    }
    return { ok: true, cardCount: rows.length, warnings };
  }

  return {
    ok: false,
    errors: ['unrecognized deck JSON: need deckName+cards or deck+cards'],
    warnings,
  };
}

/**
 * Full pipeline: parse envelope like the server, then validate the deck subtree.
 *
 * When `parsed` is a **JSON array** of note/card objects, pass `notesDeckName` (required): the client
 * wraps `{ deckName, noteType, cards }` where `noteType` is derived from the parent segment of `deckName`.
 * When `parsed` is a **deck object** (legacy), `notesDeckName` is ignored.
 */
export function validateParsedJsonForBulkFromLlmDeck(
  parsed: unknown,
  options?: { notesDeckName?: string },
): LlmDeckValidationResult {
  if (Array.isArray(parsed)) {
    const name = options?.notesDeckName?.trim() ?? "";
    if (!name) {
      return {
        ok: false,
        errors: [
          "Enter a deck name when the JSON body is an array of notes (e.g. French::Lesson1 or Knowledge::Unit2).",
        ],
        warnings: [],
      };
    }
    try {
      const deck = wrapNotesArrayToDeckPayload(parsed, name);
      return validateLlmDeckForBulkImport(deck);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid notes array";
      return { ok: false, errors: [msg], warnings: [] };
    }
  }

  try {
    const deckObj = extractDeckObjectForFlatten(parsed);
    return validateLlmDeckForBulkImport(deckObj);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON structure";
    return { ok: false, errors: [msg], warnings: [] };
  }
}
