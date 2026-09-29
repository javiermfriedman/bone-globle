import { describe, expect, it } from 'vitest'
import type { Geometry } from '../src/data/catalog'
import { WIN_COLOR, distanceBetween, heatFor, heatToColor } from '../src/game/distance'

const geo: Geometry = {
  unit: 'm',
  maxDistance: 1,
  bones: {},
  distance: { a: { b: 0.5, c: 1 }, b: { a: 0.5, c: 0.25 }, c: { a: 1, b: 0.25 } },
}

describe('distanceBetween', () => {
  it('is symmetric and zero on self', () => {
    expect(distanceBetween(geo, 'a', 'b')).toBe(0.5)
    expect(distanceBetween(geo, 'b', 'a')).toBe(0.5)
    expect(distanceBetween(geo, 'a', 'a')).toBe(0)
  })
  it('throws on unknown pairs', () => {
    expect(() => distanceBetween(geo, 'a', 'zzz')).toThrow()
  })
})

describe('heatFor', () => {
  it('is 1 at zero distance and 0 at max', () => {
    expect(heatFor(0, 1)).toBe(1)
    expect(heatFor(1, 1)).toBe(0)
    expect(heatFor(2, 1)).toBe(0)
  })
  it('is monotonic decreasing', () => {
    const h = [0, 0.2, 0.4, 0.6, 0.8, 1].map((d) => heatFor(d, 1))
    for (let i = 1; i < h.length; i++) expect(h[i]).toBeLessThan(h[i - 1])
  })
})

describe('heatToColor', () => {
  it('returns hex colors and green for the answer', () => {
    expect(heatToColor(0)).toMatch(/^#[0-9a-f]{6}$/)
    expect(heatToColor(1)).toBe('#e11e1e')
    expect(heatToColor(0.3, true)).toBe(WIN_COLOR)
  })
  it('gets redder as heat rises', () => {
    const r = (hex: string) => parseInt(hex.slice(1, 3), 16)
    expect(r(heatToColor(0.9))).toBeGreaterThan(r(heatToColor(0.1)))
  })
})
