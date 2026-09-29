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
  it('does not match on prefixes, only exact names and typos', () => {
    expect(index.search('fem').some((h) => h.slug === 'femur')).toBe(false)
    expect(index.search('femur')[0].slug).toBe('femur')
  })
  it('tolerates a leading side and a trailing "bone"', () => {
    expect(index.resolve('left femur')?.slug).toBe('femur')
    expect(index.resolve('Right Hip Bone')?.slug).toBe('hip-bone')
    expect(index.resolve('femur bone')?.slug).toBe('femur')
    expect(index.resolve('hip')?.slug).toBe('hip-bone')
    expect(index.resolve('bone')).toBeNull()
    expect(index.search('left femer')[0].slug).toBe('femur')
  })
  it('resolves ilium, ischium and pubis to the hip bone, and sesamoids to the hallux pair', () => {
    for (const q of ['ilium', 'ischium', 'pubis']) expect(index.resolve(q)?.slug).toBe('hip-bone')
    expect(index.resolve('sesamoid')?.slug).toBe('sesamoid-hallux')
    expect(index.resolve('stapes')?.slug).toBe('stapes')
  })
  it('handles rib ordinals', () => {
    expect(index.resolve('rib 2')?.slug).toBe(index.resolve('second rib')?.slug)
    expect(index.resolve('2nd rib')?.slug).toBe(index.resolve('second rib')?.slug)
  })
  it('fuzzy-matches typos', () => {
    expect(index.search('femer').some((h) => h.slug === 'femur')).toBe(true)
    expect(index.search('scapla').some((h) => h.slug === 'scapula')).toBe(true)
    expect(index.search('scafoid').some((h) => h.slug === 'carpal-scaphoid')).toBe(true)
    const t4 = index.resolve('T4')?.slug
    expect(t4).toBeTruthy()
    expect(index.search('thorasic 4').some((h) => h.slug === t4)).toBe(true)
  })
  it('returns one hit per slug, limited', () => {
    const hits = index.search('ribb', 5)
    expect(hits.length).toBeLessThanOrEqual(5)
    expect(new Set(hits.map((h) => h.slug)).size).toBe(hits.length)
  })
  it('returns nothing for empty query', () => {
    expect(index.search('   ')).toEqual([])
  })
})
