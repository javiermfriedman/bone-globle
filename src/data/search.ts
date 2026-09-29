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

/** Levenshtein distance with early exit once it exceeds `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev = new Array<number>(b.length + 1)
  const cur = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > max) return max + 1
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
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
    const q = normalize(query)
    const t = this.exact.get(q)
    return t ? { slug: t.slug, displayName: t.displayName, term: t.term, score: 1 } : null
  }

  /**
   * Ranked suggestions: prefix matches first (whole-string, then word-start), then fuzzy
   * (Levenshtein within a small budget). One hit per slug.
   */
  search(query: string, limit = 8): SearchHit[] {
    const q = normalize(query)
    if (!q) return []
    const best = new Map<string, SearchHit>()
    const consider = (t: IndexedTerm, score: number) => {
      const prev = best.get(t.slug)
      if (!prev || score > prev.score) {
        best.set(t.slug, { slug: t.slug, displayName: t.displayName, term: t.term, score })
      }
    }
    const budget = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3
    for (const t of this.terms) {
      const primaryBonus = t.isPrimary ? 0.01 : 0
      if (t.term === q) consider(t, 1)
      else if (t.term.startsWith(q)) consider(t, 0.9 - t.term.length / 1000 + primaryBonus)
      else if (t.term.includes(' ' + q)) consider(t, 0.8 - t.term.length / 1000 + primaryBonus)
      else if (t.term.includes(q)) consider(t, 0.7 - t.term.length / 1000 + primaryBonus)
      else if (q.length >= 3) {
        // Compare against the whole term and against each word for typos like "femer".
        let d = levenshtein(q, t.term, budget)
        if (d > budget) {
          for (const w of t.term.split(' ')) {
            if (Math.abs(w.length - q.length) > budget) continue
            d = Math.min(d, levenshtein(q, w, budget))
            if (d <= budget) break
          }
        }
        if (d <= budget) consider(t, 0.5 - d * 0.1 - t.term.length / 1000 + primaryBonus)
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit)
  }
}
