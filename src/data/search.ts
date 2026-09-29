import type { BoneEntry } from './catalog'

export interface SearchHit {
  slug: string
  displayName: string
  /** The term that matched (display name or synonym). */
  term: string
  score: number
}

const ORDINAL_WORDS: Record<string, string> = {
  '1st': 'first',
  '2nd': 'second',
  '3rd': 'third',
  '4th': 'fourth',
  '5th': 'fifth',
  '6th': 'sixth',
  '7th': 'seventh',
  '8th': 'eighth',
  '9th': 'ninth',
  '10th': 'tenth',
  '11th': 'eleventh',
  '12th': 'twelfth',
}

/** Lowercase, strip punctuation, collapse spaces, "2nd" -> "second". */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ORDINAL_WORDS[w] ?? w)
    .join(' ')
}

/**
 * Query spellings to try in order: as typed, without a leading "left"/"right" (students
 * copy sides off labelled diagrams), and with a trailing "bone" toggled ("femur bone",
 * "hip"). Only the query is varied, so the index itself stays strict.
 */
export function queryVariants(normalized: string): string[] {
  const out: string[] = []
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v)
  }
  push(normalized)
  const sideless = normalized.replace(/^(left|right|l|r) /, '')
  push(sideless)
  for (const v of [normalized, sideless]) {
    if (v.endsWith(' bone')) push(v.slice(0, -5))
    else if (v !== 'bone') push(`${v} bone`)
  }
  return out
}

/**
 * Edit distance with early exit once it exceeds `max`. Counts a swap of two adjacent
 * letters ("tibai" -> "tibia") as ONE edit (optimal string alignment distance), since
 * transpositions are the most common typo and plain Levenshtein would charge two.
 */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev2 = new Array<number>(b.length + 1)
  let prev = new Array<number>(b.length + 1)
  let cur = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1)
      }
      cur[j] = d
      if (d < rowMin) rowMin = d
    }
    if (rowMin > max) return max + 1
    const t = prev2
    prev2 = prev
    prev = cur
    cur = t
  }
  return prev[b.length]
}

interface IndexedTerm {
  term: string
  slug: string
  displayName: string
  isPrimary: boolean
}

export class SearchIndex {
  private terms: IndexedTerm[] = []
  private exact = new Map<string, IndexedTerm>()

  constructor(entries: BoneEntry[]) {
    for (const e of entries) {
      const seen = new Set<string>()
      const add = (raw: string, isPrimary: boolean) => {
        const term = normalize(raw)
        if (!term || seen.has(term)) return
        seen.add(term)
        const t = { term, slug: e.slug, displayName: e.displayName, isPrimary }
        this.terms.push(t)
        // First writer wins on collisions so a display name beats a stray synonym.
        if (!this.exact.has(term)) this.exact.set(term, t)
      }
      add(e.displayName, true)
      for (const s of e.synonyms) add(s, false)
    }
  }

  /** Exact (normalized) lookup, e.g. on Enter. */
  resolve(query: string): SearchHit | null {
    for (const q of queryVariants(normalize(query))) {
      const t = this.exact.get(q)
      if (t) return { slug: t.slug, displayName: t.displayName, term: t.term, score: 1 }
    }
    return null
  }

  /**
   * Spelling rescue for a name that did not resolve exactly, used only after Enter. It is
   * NOT a hint engine: the game tests recall, so it only fixes a misspelling of a name the
   * player was clearly already aiming at.
   *
   * - The query (and its queryVariants: side stripped, trailing "bone" toggled) is compared
   *   against WHOLE terms only (display names and synonyms). No per-word, prefix or
   *   substring matching, so "foot" or "fem" return nothing.
   * - Edit budget: see maxEdits(). At most 1 edit when the shorter of query/term is <= 5
   *   characters, at most 2 otherwise, never 3; and never more than floor(len / 3) of the
   *   core query length (side and trailing "bone" removed), so queries under 3 characters get no fuzzy matches at all.
   * - Only the best-distance tier is returned: if anything is 1 edit away, 2-edit matches
   *   are dropped. One hit per slug, primary display name wins ties, capped at `limit`.
   */
  search(query: string, limit = SEARCH_LIMIT): SearchHit[] {
    const raw = normalize(query)
    if (!raw) return []
    const variants = queryVariants(raw)
    // Budgets are sized from the core name the player typed (no side, no trailing "bone"),
    // so the padded "fem bone" variant cannot earn a bigger budget than "fem" itself.
    const core = raw.replace(/^(left|right|l|r) /, '').replace(/ bone$/, '') || raw
    const best = new Map<string, { hit: SearchHit; dist: number }>()
    for (const t of this.terms) {
      let dist = Infinity
      for (const q of variants) {
        const budget = maxEdits(core, t.term)
        if (budget < 0) continue
        const d = levenshtein(q, t.term, budget)
        if (d <= budget && d < dist) dist = d
      }
      if (dist === Infinity) continue
      const score = 1 - dist * 0.1 + (t.isPrimary ? 0.01 : 0) - t.term.length / 1000
      const prev = best.get(t.slug)
      if (!prev || dist < prev.dist || (dist === prev.dist && score > prev.hit.score)) {
        best.set(t.slug, {
          hit: { slug: t.slug, displayName: t.displayName, term: t.term, score },
          dist,
        })
      }
    }
    if (best.size === 0) return []
    const minDist = Math.min(...[...best.values()].map((b) => b.dist))
    return [...best.values()]
      .filter((b) => b.dist === minDist)
      .map((b) => b.hit)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}

/** Default cap on "did you mean" hits; the common case is exactly one. */
export const SEARCH_LIMIT = 3

/**
 * Maximum edits allowed between a query and a whole term (-1 = no fuzzy match):
 *   shorter of the two <= 5 chars -> 1 edit, otherwise 2 edits (never 3),
 *   and additionally capped at floor(query length / 3), so "ab" gets 0 and "fem" gets 1.
 */
export function maxEdits(query: string, term: string): number {
  const shorter = Math.min(query.length, term.length)
  const byLength = shorter <= 5 ? 1 : 2
  const byRatio = Math.floor(query.length / 3)
  const budget = Math.min(byLength, byRatio)
  return budget > 0 ? budget : -1
}
