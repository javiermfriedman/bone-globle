import { describe, expect, it } from 'vitest'
import { catalog } from '../src/data/catalog'
import { SearchIndex, levenshtein, normalize } from '../src/data/search'

const index = new SearchIndex(catalog)

describe('normalize', () => {
  it('lowercases, strips punctuation, expands ordinals', () => {
    expect(normalize('  2nd Rib! ')).toBe('second rib')
    expect(normalize('C-1')).toBe('c 1')
  })
})

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('femur', 'femur')).toBe(0)
    expect(levenshtein('femer', 'femur')).toBe(1)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })
  it('early-exits past max', () => {
    expect(levenshtein('abcdef', 'zzzzzz', 2)).toBeGreaterThan(2)
  })
})

describe('SearchIndex', () => {
  it('resolves exact names and synonyms', () => {
    expect(index.resolve('Patella')?.slug).toBe('patella')
    expect(index.resolve('kneecap')?.slug).toBe('patella')
    expect(index.resolve('atlas')?.slug).toMatch(/c1|cervical-1|vertebra-c1/)
    expect(index.resolve('not a bone')).toBeNull()
  })
  it('ranks prefix matches first', () => {
    const hits = index.search('fem')
    expect(hits[0].slug).toBe('femur')
  })
  it('handles rib ordinals', () => {
    expect(index.resolve('rib 2')?.slug).toBe(index.resolve('second rib')?.slug)
    expect(index.resolve('2nd rib')?.slug).toBe(index.resolve('second rib')?.slug)
  })
  it('fuzzy-matches typos', () => {
    expect(index.search('femer').some((h) => h.slug === 'femur')).toBe(true)
    expect(index.search('scapla').some((h) => h.slug === 'scapula')).toBe(true)
  })
  it('returns one hit per slug, limited', () => {
    const hits = index.search('rib', 5)
    expect(hits.length).toBeLessThanOrEqual(5)
    expect(new Set(hits.map((h) => h.slug)).size).toBe(hits.length)
  })
  it('returns nothing for empty query', () => {
    expect(index.search('   ')).toEqual([])
  })
})
