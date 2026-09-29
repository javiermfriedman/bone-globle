import { describe, expect, it } from 'vitest'
import { SUBREGION_ORDER, catalog, groupBySubregion } from '../src/data/catalog'

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
