// Robust keyword relevance matching for client filtering.
//
// Pure module (no React/Supabase deps) so it can run in the browser, in API
// routes, and in Vitest. Replaces the naive `text.includes(keyword)` matching,
// which produced false positives (acronym "ONS" matching inside "responsável")
// and false negatives (accents: "térmica" vs "termica").
//
// Strategy: normalize text (strip accents, lowercase, punctuation→space) then
// match on whole tokens (words/acronyms) or contiguous token subsequences
// (phrases), tolerating a simple plural "s". Favors recall — a client matches
// an article if ANY keyword matches (OR), like the previous behavior.

export type KeywordKind = 'word' | 'phrase' | 'acronym'

export interface ParsedKeyword {
  /** Original term as typed by the curator. */
  raw: string
  /** Normalized term (no accents, lowercase, collapsed spaces). */
  normalized: string
  /** Normalized term split into tokens. */
  tokens: string[]
  kind: KeywordKind
}

// Accent stripping is useful for phrases, but a single geographic term such as
// "Pará" becomes the Portuguese stopword "para". A bare stopword can never be a
// safe relevance signal; phrases such as "mineração no Pará" remain valid.
const UNSAFE_SINGLE_TERMS = new Set([
  'a',
  'as',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'para',
  'por',
  'sem',
  'um',
  'uma',
])

/**
 * Normalize text for comparison: NFD + strip diacritics, lowercase, turn any
 * non-alphanumeric run into a single space, trim. Deterministic, no stemming.
 * "Térmica, à BR-101!" -> "termica a br 101"
 */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics (accents become ASCII)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ') // punctuation/symbols -> space (text is ASCII post-normalize)
    .trim()
    .replace(/\s+/g, ' ')
}

function tokenize(normalized: string): string[] {
  return normalized ? normalized.split(' ').filter(Boolean) : []
}

/**
 * Classify a keyword to decide how it should match:
 *  - contains whitespace          -> 'phrase'
 *  - <= 4 chars AND all-uppercase  -> 'acronym' (ONS, CCEE, DNIT)
 *  - otherwise                    -> 'word'
 */
export function classifyKeyword(raw: string): KeywordKind {
  const trimmed = raw.trim()
  if (/\s/.test(trimmed)) return 'phrase'
  // Acronyms in this domain are ASCII (ONS, CCEE, DNIT); ASCII check avoids the
  // unicode `u` regex flag, which needs a newer tsconfig target.
  const letters = trimmed.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 0 && letters.length <= 4 && letters === letters.toUpperCase()) {
    return 'acronym'
  }
  return 'word'
}

/**
 * Union a client's keywords with its synonym terms. `synonyms` is free text with
 * one group per line, terms comma-separated (e.g. "apagão, blecaute"). Every term
 * across all groups is added to the match set (OR matching), broadening recall
 * beyond the morphological variations the matcher already handles.
 */
export function expandTerms(
  keywords: string[] | null | undefined,
  synonyms: string | null | undefined
): string[] {
  const terms = [...(keywords || [])]
  if (synonyms) {
    for (const part of synonyms.split(/[\n,;]+/)) {
      const t = part.trim()
      if (t) terms.push(t)
    }
  }
  return terms
}

/** Convert the client's raw keywords (TEXT[]) into ParsedKeyword[]. Drops empties. */
export function parseKeywords(raw: string[] | null | undefined): ParsedKeyword[] {
  if (!raw?.length) return []
  const out: ParsedKeyword[] = []
  for (const term of raw) {
    if (typeof term !== 'string') continue
    const normalized = normalizeText(term)
    if (!normalized) continue
    const tokens = tokenize(normalized)
    if (tokens.length === 1 && UNSAFE_SINGLE_TERMS.has(tokens[0])) continue
    out.push({
      raw: term,
      normalized,
      tokens,
      kind: classifyKeyword(term),
    })
  }
  return out
}

/** Two tokens match if equal, or differ only by a trailing 's' (simple plural). */
function tokensEqual(a: string, b: string, allowPlural = true): boolean {
  if (a === b) return true
  if (!allowPlural) return false
  if (a.length > 1 && a === b + 's') return true
  if (b.length > 1 && b === a + 's') return true
  return false
}

/** Find a contiguous run of `needle` tokens inside `haystack` tokens. */
function containsTokenSequence(haystack: string[], needle: string[], allowPlural: boolean): boolean {
  if (needle.length === 0) return false
  if (needle.length === 1) return haystack.some((t) => tokensEqual(t, needle[0], allowPlural))
  const last = needle.length - 1
  for (let i = 0; i + last < haystack.length; i++) {
    let ok = true
    for (let j = 0; j < needle.length; j++) {
      // Exact match on inner tokens; tolerate plural only on the final token.
      const equal =
        j === last ? tokensEqual(haystack[i + j], needle[j], allowPlural) : haystack[i + j] === needle[j]
      if (!equal) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

/** Match a single parsed keyword against already-normalized text. */
export function matchKeyword(parsed: ParsedKeyword, normalizedText: string): boolean {
  if (!parsed.tokens.length || !normalizedText) return false
  const haystack = tokenize(normalizedText)
  return containsTokenSequence(haystack, parsed.tokens, parsed.kind !== 'acronym')
}

interface Fields {
  title?: string | null
  excerpt?: string | null
  content?: string | null
}

function normalizedFieldText(fields: Fields): string {
  // content is optional and usually absent in list views; included for reuse.
  return normalizeText([fields.title, fields.excerpt, fields.content].filter(Boolean).join(' '))
}

/**
 * True if ANY keyword matches (OR semantics — preserves recall). Returns false
 * when there are no keywords (callers decide that "no keywords = don't filter").
 */
export function isRelevant(parsed: ParsedKeyword[], fields: Fields): boolean {
  if (!parsed.length) return false
  const text = normalizedFieldText(fields)
  if (!text) return false
  return parsed.some((kw) => matchKeyword(kw, text))
}

/**
 * Relevance score = number of distinct keywords that match, weighting title
 * matches above excerpt/content. For optional ranking/badges; the filter itself
 * uses the boolean isRelevant.
 */
export function relevanceScore(parsed: ParsedKeyword[], fields: Fields): number {
  if (!parsed.length) return 0
  const titleText = normalizeText(fields.title)
  const bodyText = normalizeText([fields.excerpt, fields.content].filter(Boolean).join(' '))
  let score = 0
  for (const kw of parsed) {
    if (matchKeyword(kw, titleText)) score += 2
    else if (matchKeyword(kw, bodyText)) score += 1
  }
  return score
}

/**
 * Collapse the same story arriving from different feeds (same normalized title).
 * Keeps the first occurrence (input should be pre-ordered, e.g. by date desc) and
 * backfills a missing image from a later duplicate. Untitled rows are kept as-is.
 */
export function dedupeByTitle<T extends { id: string; title: string; image_url?: string | null }>(
  articles: T[]
): T[] {
  const byTitle = new Map<string, T>()
  for (const a of articles) {
    const key = normalizeText(a.title) || a.id
    const existing = byTitle.get(key)
    if (!existing) byTitle.set(key, a)
    else if (!existing.image_url && a.image_url) existing.image_url = a.image_url
  }
  return Array.from(byTitle.values())
}
