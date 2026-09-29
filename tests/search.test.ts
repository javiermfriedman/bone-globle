import { describe, expect, it } from 'vitest'
import { catalog, type BoneEntry } from '../src/data/catalog'
import { SEARCH_LIMIT, SearchIndex, levenshtein, maxEdits, normalize } from '../src/data/search'

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
    // adjacent swap counts as one edit
    expect(levenshtein('tibai', 'tibia')).toBe(1)
    expect(levenshtein('ca', 'abc')).toBe(3)
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
    expect(index.search('femur').map((h) => h.slug)).toEqual(['femur'])
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
    expect(index.resolve('rib 2')?.slug).toBe('ribs')
    expect(index.resolve('2nd rib')?.slug).toBe('ribs')
    expect(index.resolve('second rib')?.slug).toBe('ribs')
  })
  it('resolves individual names to their group entry', () => {
    const cases: [string, string][] = [
      ['rib', 'ribs'],
      ['7th rib', 'ribs'],
      ['floating rib', 'ribs'],
      ['C5', 'vertebrae-cervical'],
      ['vertebra prominens', 'vertebrae-cervical'],
      ['atlas', 'vertebra-c1'],
      ['C2', 'vertebra-c2'],
      ['T4', 'vertebrae-thoracic'],
      ['L4', 'vertebrae-lumbar'],
      ['third metacarpal', 'metacarpals'],
      ['thumb metacarpal', 'metacarpals'],
      ['first metatarsal', 'metatarsals'],
      ['distal phalanx of thumb', 'phalanges-distal-hand'],
      ['middle phalanx of ring finger', 'phalanges-middle-hand'],
      ['proximal phalanx', 'phalanges-proximal-hand'],
      ['proximal phalanx of big toe', 'phalanges-proximal-foot'],
      ['middle phalanx of little toe', 'phalanges-middle-foot'],
      ['distal phalanx of foot', 'phalanges-distal-foot'],
    ]
    for (const [q, slug] of cases) expect(index.resolve(q)?.slug, q).toBe(slug)
  })
  it('leaves bare group words unresolved so the player names the region or row', () => {
    for (const q of [
      'vertebra',
      'vertebrae',
      'phalanges',
      'phalanx',
      'finger bones',
      'toe bones',
    ]) {
      expect(index.resolve(q), q).toBeNull()
    }
    // The great toe has no middle phalanx.
    expect(index.resolve('middle phalanx of big toe')).toBeNull()
  })
  it('fuzzy-matches typos of whole names', () => {
    expect(index.search('scapla').map((h) => h.slug)).toEqual(['scapula'])
    expect(index.search('scafoid').some((h) => h.slug === 'carpal-scaphoid')).toBe(true)
    expect(index.search('thorasic 4').some((h) => h.slug === 'vertebrae-thoracic')).toBe(true)
  })
  it('never suggests bones from a single word of a longer name', () => {
    expect(index.search('foot')).toEqual([])
    expect(index.search('hand')).toEqual([])
    expect(index.search('phalanx')).toEqual([])
  })
  it('does not rescue partial names', () => {
    expect(index.search('fem')).toEqual([])
    expect(index.search('humer')).toEqual([])
  })
  it('rescues one-letter misspellings to exactly the intended bone', () => {
    expect(index.search('femer').map((h) => h.slug)).toEqual(['femur'])
    expect(index.search('scapoid').map((h) => h.slug)).toEqual(['carpal-scaphoid'])
    expect(index.search('humerous').map((h) => h.slug)).toEqual(['humerus'])
    // swapped adjacent letters count as one edit
    expect(index.search('tibai').map((h) => h.slug)).toEqual(['tibia'])
  })
  it('rejects queries three edits away', () => {
    expect(levenshtein('femoor', 'femur')).toBe(2)
    expect(levenshtein('fimoor', 'femur')).toBe(3)
    expect(index.search('fimoor')).toEqual([])
    expect(index.search('humorouss')).toEqual([])
  })
  it('only returns the best-distance tier', () => {
    const fake = (slug: string, displayName: string) =>
      ({ slug, displayName, synonyms: [] }) as unknown as BoneEntry
    const small = new SearchIndex([
      fake('abcdefgx', 'abcdefgx'), // 1 edit from the query
      fake('abcdefxy', 'abcdefxy'), // 2 edits
      fake('abcdexyz', 'abcdexyz'), // 3 edits
    ])
    expect(levenshtein('abcdefgh', 'abcdefxy')).toBe(2)
    expect(small.search('abcdefgh').map((h) => h.slug)).toEqual(['abcdefgx'])
    // Without the 1-edit candidate, the 2-edit one is offered, the 3-edit one never.
    const noClose = new SearchIndex([fake('abcdefxy', 'abcdefxy'), fake('abcdexyz', 'abcdexyz')])
    expect(noClose.search('abcdefgh').map((h) => h.slug)).toEqual(['abcdefxy'])
    // On the real catalog, "radios" offers only radius.
    expect(index.search('radios').map((h) => h.slug)).toEqual(['radius'])
  })
  it('uses tight edit budgets', () => {
    expect(maxEdits('ab', 'ab')).toBe(-1)
    expect(maxEdits('fem', 'femur')).toBe(1)
    expect(maxEdits('femer', 'femur')).toBe(1)
    expect(maxEdits('scapoid', 'scaphoid')).toBe(2)
    expect(maxEdits('scapoid', 'rib')).toBe(1)
  })
  it('returns one hit per slug, capped at the limit', () => {
    for (const q of ['ribb', 'rib 13', 'metacarpl', 'phalanxx']) {
      const hits = index.search(q)
      expect(hits.length).toBeLessThanOrEqual(SEARCH_LIMIT)
      expect(new Set(hits.map((h) => h.slug)).size).toBe(hits.length)
    }
  })
  it('returns nothing for empty query', () => {
    expect(index.search('   ')).toEqual([])
  })
})
