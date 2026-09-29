const RECENT_KEY = 'bonegloble.recentAnswers'
export const RECENT_LIMIT = 10

export interface Storage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/**
 * Recent answers, oldest first. When `valid` is given, slugs outside it are dropped, so
 * entries saved by an older catalog (e.g. "rib-07" before ribs became one answer) vanish.
 */
export function readRecent(
  storage: Storage | null = safeStorage(),
  valid?: ReadonlySet<string>,
): string[] {
  try {
    const raw = storage?.getItem(RECENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string' && (!valid || valid.has(x)))
  } catch {
    return []
  }
}

export function pushRecent(
  slug: string,
  storage: Storage | null = safeStorage(),
  valid?: ReadonlySet<string>,
): string[] {
  const next = [...readRecent(storage, valid).filter((s) => s !== slug), slug].slice(-RECENT_LIMIT)
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
  return next
}

/** Uniform over `pool` minus `recent` (falls back to the whole pool if that empties it). */
export function pickAnswer(
  pool: string[],
  recent: string[],
  rng: () => number = Math.random,
): string {
  const exclude = new Set(recent)
  let candidates = pool.filter((s) => !exclude.has(s))
  if (candidates.length === 0) candidates = pool
  if (candidates.length === 0) throw new Error('Empty answer pool')
  return candidates[Math.floor(rng() * candidates.length) % candidates.length]
}
