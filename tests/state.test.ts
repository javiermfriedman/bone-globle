import { describe, expect, it } from 'vitest'
import type { Geometry } from '../src/data/catalog'
import { initialState, reduce, sortedByHeat } from '../src/game/state'
import { pickAnswer, pushRecent, readRecent, RECENT_LIMIT, type Storage } from '../src/game/random'

const geometry: Geometry = {
  unit: 'm',
  maxDistance: 1,
  bones: {},
  distance: { a: { b: 0.5, c: 1 }, b: { a: 0.5, c: 0.25 }, c: { a: 1, b: 0.25 } },
}

class MemStorage implements Storage {
  m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
}

describe('game reducer', () => {
  it('records guesses with distance and heat', () => {
    let s = initialState('a')
    s = reduce(s, { type: 'guess', slug: 'b', geometry })
    expect(s.guesses).toHaveLength(1)
    expect(s.guesses[0]).toMatchObject({ slug: 'b', distance: 0.5 })
    expect(s.status).toBe('playing')
  })
  it('ignores repeated guesses', () => {
    let s = initialState('a')
    s = reduce(s, { type: 'guess', slug: 'b', geometry })
    s = reduce(s, { type: 'guess', slug: 'b', geometry })
    expect(s.guesses).toHaveLength(1)
  })
  it('wins on the answer and freezes afterwards', () => {
    let s = initialState('a')
    s = reduce(s, { type: 'guess', slug: 'a', geometry })
    expect(s.status).toBe('won')
    expect(s.guesses[0].heat).toBe(1)
    s = reduce(s, { type: 'guess', slug: 'b', geometry })
    expect(s.guesses).toHaveLength(1)
  })
  it('newGame resets and bumps gameId', () => {
    let s = initialState('a')
    s = reduce(s, { type: 'guess', slug: 'a', geometry })
    s = reduce(s, { type: 'newGame', answer: 'c' })
    expect(s).toMatchObject({ answer: 'c', guesses: [], status: 'playing', gameId: 2 })
  })
  it('sorts by heat, hottest first', () => {
    let s = initialState('a')
    s = reduce(s, { type: 'guess', slug: 'c', geometry })
    s = reduce(s, { type: 'guess', slug: 'b', geometry })
    expect(sortedByHeat(s.guesses).map((g) => g.slug)).toEqual(['b', 'c'])
  })
})

describe('random answer selection', () => {
  it('avoids recent answers', () => {
    const pool = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) expect(pickAnswer(pool, ['a', 'b'], Math.random)).toBe('c')
  })
  it('falls back to the whole pool when everything is recent', () => {
    expect(['a', 'b']).toContain(pickAnswer(['a', 'b'], ['a', 'b']))
  })
  it('keeps at most RECENT_LIMIT entries, de-duplicated', () => {
    const st = new MemStorage()
    for (let i = 0; i < RECENT_LIMIT + 5; i++) pushRecent(`s${i}`, st)
    pushRecent('s14', st)
    const recent = readRecent(st)
    expect(recent).toHaveLength(RECENT_LIMIT)
    expect(recent[recent.length - 1]).toBe('s14')
    expect(new Set(recent).size).toBe(RECENT_LIMIT)
  })
  it('survives corrupt storage', () => {
    const st = new MemStorage()
    st.setItem('bonegloble.recentAnswers', '{not json')
    expect(readRecent(st)).toEqual([])
  })
  it('drops slugs from an older catalog when given the valid set', () => {
    const st = new MemStorage()
    st.setItem('bonegloble.recentAnswers', JSON.stringify(['rib-07', 'femur', 'vertebra-t4']))
    const valid = new Set(['femur', 'ribs'])
    expect(readRecent(st, valid)).toEqual(['femur'])
    expect(pushRecent('ribs', st, valid)).toEqual(['femur', 'ribs'])
    expect(readRecent(st)).toEqual(['femur', 'ribs'])
    expect(pickAnswer(['femur', 'ribs', 'tibia'], readRecent(st, valid))).toBe('tibia')
  })
})
