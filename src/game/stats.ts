import type { Storage } from './random'

const STATS_KEY = 'bonegloble.stats'

export interface SlugStats {
  timesAnswer: number
  totalGuessesWhenAnswer: number
}

export interface Stats {
  gamesPlayed: number
  totalGuesses: number
  perSlug: Record<string, SlugStats>
}

export const emptyStats = (): Stats => ({ gamesPlayed: 0, totalGuesses: 0, perSlug: {} })

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function readStats(storage: Storage | null = safeStorage()): Stats {
  try {
    const raw = storage?.getItem(STATS_KEY)
    if (!raw) return emptyStats()
    const s = JSON.parse(raw) as Partial<Stats>
    return {
      gamesPlayed: s.gamesPlayed ?? 0,
      totalGuesses: s.totalGuesses ?? 0,
      perSlug: s.perSlug ?? {},
    }
  } catch {
    return emptyStats()
  }
}

export function recordWin(stats: Stats, answer: string, guessCount: number): Stats {
  const prev = stats.perSlug[answer] ?? { timesAnswer: 0, totalGuessesWhenAnswer: 0 }
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    totalGuesses: stats.totalGuesses + guessCount,
    perSlug: {
      ...stats.perSlug,
      [answer]: {
        timesAnswer: prev.timesAnswer + 1,
        totalGuessesWhenAnswer: prev.totalGuessesWhenAnswer + guessCount,
      },
    },
  }
}

export function writeStats(stats: Stats, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    /* ignore */
  }
}

export function averageGuesses(stats: Stats): number {
  return stats.gamesPlayed ? stats.totalGuesses / stats.gamesPlayed : 0
}

/** Slugs with the highest average guess count, ties broken by times seen. */
export function hardestBones(stats: Stats, limit = 5): { slug: string; avg: number; n: number }[] {
  return Object.entries(stats.perSlug)
    .map(([slug, s]) => ({ slug, avg: s.totalGuessesWhenAnswer / s.timesAnswer, n: s.timesAnswer }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n)
    .slice(0, limit)
}
