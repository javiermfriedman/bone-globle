import { describe, expect, it } from 'vitest'
import { SUBREGION_ORDER, catalog, groupBySubregion } from '../src/data/catalog'
import { filterBones, summarizeBones } from '../src/data/boneFilter'

const answerPool = catalog.filter((b) => !b.optional && b.meshNames.length > 0).map((b) => b.slug)

describe('groupBySubregion', () => {
  it('the answer pool is 117 bones and excludes the mesh-less coccyx and ossicles', () => {
    expect(answerPool).toHaveLength(117)
    expect(answerPool).not.toContain('coccyx')
    expect(answerPool).not.toContain('stapes')
    expect(answerPool).toContain('sesamoid-hallux')
  })

  it('covers every slug in the pool exactly once', () => {
    const grouped = groupBySubregion(answerPool).flatMap((g) => g.bones.map((b) => b.slug))
    expect(grouped).toHaveLength(answerPool.length)
    expect(new Set(grouped).size).toBe(answerPool.length)
    expect([...grouped].sort()).toEqual([...answerPool].sort())
  })

  it('emits group keys in SUBREGION_ORDER order, skull first and foot last', () => {
    const keys = groupBySubregion(answerPool).map((g) => g.key)
    const order = SUBREGION_ORDER.map((s) => s.key)

    for (const k of keys) expect(order).toContain(k)
    expect(keys).toEqual(order.filter((k) => keys.includes(k)))
    expect(keys[0]).toBe('skull')
    expect(keys[keys.length - 1]).toBe('foot')
  })

  it('omits empty groups and keeps catalog order within a group', () => {
    const groups = groupBySubregion(answerPool)
    expect(groups.every((g) => g.bones.length > 0)).toBe(true)

    const pos = new Map(catalog.map((b, i) => [b.slug, i]))
    for (const g of groups) {
      const idx = g.bones.map((b) => pos.get(b.slug)!)
      expect(idx).toEqual([...idx].sort((a, b) => a - b))
    }
  })

  it('returns nothing for an empty slug list', () => {
    expect(groupBySubregion([])).toEqual([])
  })
})

describe('filterBones', () => {
  const entries = answerPool.map((s) => catalog.find((b) => b.slug === s)!)
  const slugs = (q: string) => filterBones(entries, q).map((m) => m.bone.slug)

  it('returns every entry, in order, for an empty or blank query', () => {
    expect(slugs('')).toEqual(answerPool)
    expect(slugs('   ')).toEqual(answerPool)
    expect(filterBones(entries, '').every((m) => m.via === undefined)).toBe(true)
  })

  it('matches display-name substrings', () => {
    const hits = slugs('fem')
    expect(hits).toContain('femur')
    for (const m of filterBones(entries, 'fem')) {
      expect(m.bone.displayName.toLowerCase()).toContain('fem')
    }
  })

  it('matches synonyms and reports the synonym it matched through', () => {
    expect(filterBones(entries, 'kneecap')).toEqual([
      { bone: entries.find((b) => b.slug === 'patella'), via: 'kneecap' },
    ])
    const blade = filterBones(entries, 'shoulder bl').find((m) => m.bone.slug === 'scapula')
    expect(blade?.via).toBe('shoulder blade')
    // A display-name hit carries no "via" even though synonyms also match.
    expect(filterBones(entries, 'patella').find((m) => m.bone.slug === 'patella')?.via).toBe(
      undefined,
    )
  })

  it('matches a subregion label, e.g. "skull" returns the whole skull group', () => {
    const skull = entries.filter((b) => b.subregion === 'skull').map((b) => b.slug)
    expect(skull.length).toBeGreaterThan(0)
    for (const s of skull) expect(slugs('skull')).toContain(s)
    expect(slugs('SKULL')).toEqual(slugs('skull'))
  })

  it('returns nothing when no bone matches', () => {
    expect(filterBones(entries, 'xyzzy')).toEqual([])
  })

  it('ignores case and punctuation via normalize', () => {
    expect(slugs('FEMUR!')).toEqual(slugs('femur'))
    expect(slugs('  Fe-Mur ')).toEqual(slugs('fe mur'))
    expect(slugs('femur.')).toContain('femur')
  })
})

describe('summarizeBones', () => {
  it('splits the pool into axial and appendicular without hardcoded totals', () => {
    const entries = answerPool.map((s) => catalog.find((b) => b.slug === s)!)
    const s = summarizeBones(entries)
    expect(s.total).toBe(answerPool.length)
    expect(s.axial + s.appendicular).toBe(s.total)
    expect(s.paired).toBeGreaterThan(0)
    expect(s.paired).toBeLessThanOrEqual(s.total)
  })
})
