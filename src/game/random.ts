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

export function readRecent(storage: Storage | null = safeStorage()): string[] {
  try {
    const raw = storage?.getItem(RECENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function pushRecent(slug: string, storage: Storage | null = safeStorage()): string[] {
  const next = [...readRecent(storage).filter((s) => s !== slug), slug].slice(-RECENT_LIMIT)
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
