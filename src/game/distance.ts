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

type Stop = [number, [number, number, number]]
// Globle-ish ramp: cool grey-blue -> yellow -> orange -> red.
const RAMP: Stop[] = [
  [0.0, [95, 110, 140]],
  [0.35, [190, 190, 120]],
  [0.6, [250, 210, 60]],
  [0.8, [250, 130, 40]],
  [1.0, [225, 30, 30]],
]
export const WIN_COLOR = '#2ee06a'

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
}

export function heatToColor(heat: number, isAnswer = false): string {
  if (isAnswer) return WIN_COLOR
  const h = Math.min(1, Math.max(0, heat))
  for (let i = 1; i < RAMP.length; i++) {
    const [t0, c0] = RAMP[i - 1]
    const [t1, c1] = RAMP[i]
    if (h <= t1) {
      const k = (h - t0) / (t1 - t0)
      return toHex([
        c0[0] + (c1[0] - c0[0]) * k,
        c0[1] + (c1[1] - c0[1]) * k,
        c0[2] + (c1[2] - c0[2]) * k,
      ])
    }
  }
  return toHex(RAMP[RAMP.length - 1][1])
}
