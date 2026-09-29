import type { Geometry } from '../data/catalog'
import { distanceBetween, heatFor } from './distance'

export interface Guess {
  slug: string
  distance: number
  heat: number
}

export type Status = 'playing' | 'won'

export interface GameState {
  answer: string
  guesses: Guess[]
  status: Status
  gameId: number
}

export type Action =
  { type: 'guess'; slug: string; geometry: Geometry } | { type: 'newGame'; answer: string }

export function initialState(answer: string, gameId = 1): GameState {
  return { answer, guesses: [], status: 'playing', gameId }
}

export function hasGuessed(state: GameState, slug: string): boolean {
  return state.guesses.some((g) => g.slug === slug)
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'guess': {
      if (state.status !== 'playing') return state
      if (hasGuessed(state, action.slug)) return state
      const distance = distanceBetween(action.geometry, state.answer, action.slug)
      const heat = heatFor(distance, action.geometry.maxDistance)
      const guess: Guess = { slug: action.slug, distance, heat }
      const guesses = [...state.guesses, guess]
      return {
        ...state,
        guesses,
        status: action.slug === state.answer ? 'won' : 'playing',
      }
    }
    case 'newGame':
      return initialState(action.answer, state.gameId + 1)
  }
}

/** Guesses sorted hottest first, most recent breaking ties. */
export function sortedByHeat(guesses: Guess[]): Guess[] {
  return guesses
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.heat - a.g.heat || b.i - a.i)
    .map((x) => x.g)
}
