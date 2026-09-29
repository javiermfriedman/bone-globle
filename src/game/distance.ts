import type { Geometry } from '../data/catalog'

export function distanceBetween(geo: Geometry, a: string, b: string): number {
  if (a === b) return 0
  const d = geo.distance[a]?.[b] ?? geo.distance[b]?.[a]
  if (d === undefined) throw new Error(`No distance for ${a} <-> ${b}`)
  return d
}

/** 0 = far, 1 = the answer itself. Gamma > 1 spreads nearby bones apart visually. */
export function heatFor(distance: number, maxDistance: number, gamma = 1.6): number {
  if (maxDistance <= 0) return 1
  const t = Math.min(1, Math.max(0, distance / maxDistance))
  return Math.pow(1 - t, gamma)
}

type RGB = [number, number, number]
type Stop = [number, RGB]
// Globle-ish ramp: cool slate -> warm gold -> amber -> orange -> red.
const RAMP: Stop[] = [
  [0.0, [100, 116, 150]],
  [0.3, [206, 192, 132]],
  [0.55, [246, 190, 64]],
  [0.78, [240, 118, 42]],
  [1.0, [220, 38, 38]],
]
export const WIN_COLOR = '#2ee06a'

function toHex(rgb: RGB): string {
  return '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
}

// Mix in linear light so the mid-tones stay clean instead of going muddy.
const toLinear = (c: number) => Math.pow(c / 255, 2.2)
const toSrgb = (c: number) => 255 * Math.pow(c, 1 / 2.2)
function mix(a: RGB, b: RGB, k: number): RGB {
  return a.map((c, i) => toSrgb(toLinear(c) + (toLinear(b[i]) - toLinear(c)) * k)) as RGB
}

export function heatToColor(heat: number, isAnswer = false): string {
  if (isAnswer) return WIN_COLOR
  const h = Math.min(1, Math.max(0, heat))
  for (let i = 1; i < RAMP.length; i++) {
    const [t0, c0] = RAMP[i - 1]
    const [t1, c1] = RAMP[i]
    if (h <= t1) {
      const k = (h - t0) / (t1 - t0)
      return toHex(mix(c0, c1, k))
    }
  }
  return toHex(RAMP[RAMP.length - 1][1])
}
