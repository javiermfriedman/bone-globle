import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalize } from '../src/data/search'

type Vec3 = [number, number, number]

interface CatalogEntry {
  slug: string
  displayName: string
  synonyms: string[]
  region: string
  subregion: string
  paired: boolean
  optional: boolean
  meshNames: string[]
  info: Record<string, string>
}

interface Geometry {
  unit: string
  maxDistance: number
  bones: Record<string, { centroids: Vec3[]; bboxCenter: Vec3; radius: number }>
  distance: Record<string, Record<string, number>>
}

const root = process.cwd()
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const catalog: CatalogEntry[] = JSON.parse(read('data/bone_catalog.json'))
const ignored: string[] = JSON.parse(read('data/ignored_meshes.json')).ignored
const nodeNames: string[] = read('pipeline/node_names.txt')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
const geometry: Geometry = JSON.parse(read('public/data/geometry.json'))

const nodeSet = new Set(nodeNames)
const ignoredSet = new Set(ignored)
const withGeometry = catalog.filter((e) => e.meshNames.length > 0)

describe('catalog integrity', () => {
  it('every catalog meshName exists in the GLB node list', () => {
    const missing = catalog.flatMap((e) =>
      e.meshNames.filter((m) => !nodeSet.has(m)).map((m) => `${e.slug} -> ${m}`),
    )
    expect(missing).toEqual([])
  })

  it('every GLB node is mapped by exactly one entry or ignored, never both', () => {
    const owners = new Map<string, string[]>()
    for (const e of catalog) {
      for (const m of e.meshNames) {
        owners.set(m, [...(owners.get(m) ?? []), e.slug])
      }
    }

    const claimedTwice = [...owners].filter(([, slugs]) => slugs.length > 1)
    expect(claimedTwice).toEqual([])

    const orphans = nodeNames.filter((n) => !owners.has(n) && !ignoredSet.has(n))
    expect(orphans).toEqual([])

    const both = nodeNames.filter((n) => owners.has(n) && ignoredSet.has(n))
    expect(both).toEqual([])

    const phantomIgnores = ignored.filter((n) => !nodeSet.has(n))
    expect(phantomIgnores).toEqual([])

    expect(owners.size + ignored.length).toBe(nodeNames.length)
  })

  it('slugs are unique', () => {
    const slugs = catalog.map((e) => e.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('non-optional entries have at least one mesh, paired entries at least two', () => {
    const emptyNonOptional = catalog.filter((e) => !e.optional && e.meshNames.length === 0)
    expect(emptyNonOptional.map((e) => e.slug)).toEqual([])

    const underPaired = catalog.filter((e) => e.paired && !e.optional && e.meshNames.length < 2)
    expect(underPaired.map((e) => e.slug)).toEqual([])
  })

  it('no two entries share a normalized display name or synonym', () => {
    // The search index is first-writer-wins, so a shared term would silently lose.
    const owner = new Map<string, string>()
    const clashes: string[] = []
    for (const e of catalog) {
      for (const term of new Set([e.displayName, ...e.synonyms].map(normalize))) {
        const prev = owner.get(term)
        if (prev && prev !== e.slug) clashes.push(`"${term}": ${prev} / ${e.slug}`)
        else owner.set(term, e.slug)
      }
    }
    expect(clashes).toEqual([])
  })

  it('maps all 206 meshes, with groups of the expected size', () => {
    const all = catalog.flatMap((e) => e.meshNames)
    expect(all).toHaveLength(206)
    expect(new Set(all).size).toBe(206)
    const count = (slug: string) => catalog.find((e) => e.slug === slug)?.meshNames.length
    expect(count('ribs')).toBe(24)
    expect(count('vertebrae-cervical')).toBe(5)
    expect(count('vertebrae-thoracic')).toBe(12)
    expect(count('vertebrae-lumbar')).toBe(5)
    expect(count('metacarpals')).toBe(10)
    expect(count('metatarsals')).toBe(10)
    for (const limb of ['hand', 'foot']) {
      expect(count(`phalanges-proximal-${limb}`)).toBe(10)
      // Thumb and great toe have no middle phalanx: 4 per side.
      expect(count(`phalanges-middle-${limb}`)).toBe(8)
      expect(count(`phalanges-distal-${limb}`)).toBe(10)
    }
    const footMiddle = catalog.find((e) => e.slug === 'phalanges-middle-foot')!.meshNames
    expect(footMiddle.some((m) => /big toe|great toe|hallux/i.test(m))).toBe(false)
  })

  it('every entry includes its lowercased displayName as a synonym', () => {
    const bad = catalog.filter((e) => !e.synonyms.includes(e.displayName.toLowerCase()))
    expect(bad.map((e) => e.slug)).toEqual([])
  })
})

describe('geometry.json', () => {
  it('has a bones entry and a full distance row for every entry with meshes', () => {
    const slugs = withGeometry.map((e) => e.slug)

    expect(Object.keys(geometry.bones).sort()).toEqual([...slugs].sort())
    expect(Object.keys(geometry.distance).sort()).toEqual([...slugs].sort())

    for (const e of withGeometry) {
      const bone = geometry.bones[e.slug]
      expect(bone.centroids).toHaveLength(e.meshNames.length)
      expect(bone.bboxCenter).toHaveLength(3)
      expect(bone.radius).toBeGreaterThan(0)

      const row = geometry.distance[e.slug]
      for (const other of slugs) {
        if (other === e.slug) continue
        expect(typeof row[other], `${e.slug} -> ${other}`).toBe('number')
      }
    }
  })

  it('omits geometry for entries with no meshes', () => {
    for (const e of catalog) {
      if (e.meshNames.length === 0) {
        expect(geometry.bones[e.slug]).toBeUndefined()
        expect(geometry.distance[e.slug]).toBeUndefined()
      }
    }
  })

  it('distance is symmetric and self-distance is zero or absent', () => {
    for (const [a, row] of Object.entries(geometry.distance)) {
      expect(row[a] ?? 0).toBe(0)
      for (const [b, d] of Object.entries(row)) {
        if (a === b) continue
        expect(geometry.distance[b][a], `${a}/${b}`).toBe(d)
        expect(d).toBeGreaterThan(0)
      }
    }
  })

  it('maxDistance equals the maximum in the matrix', () => {
    let max = 0
    for (const row of Object.values(geometry.distance)) {
      for (const d of Object.values(row)) if (d > max) max = d
    }
    expect(geometry.maxDistance).toBe(max)
    expect(geometry.unit).toBe('m')
  })

  it('paired bones have centroids on both sides of the midline', () => {
    const bad: string[] = []
    for (const e of withGeometry) {
      if (!e.paired) continue
      const xs = geometry.bones[e.slug].centroids.map((c) => c[0])
      if (!(xs.some((x) => x > 0) && xs.some((x) => x < 0))) bad.push(e.slug)
    }
    expect(bad).toEqual([])
  })
})

describe('info cards', () => {
  it('every answerable bone has non-empty articulations, landmarks and fact', () => {
    for (const b of catalog) {
      if (b.meshNames.length === 0) continue
      for (const k of ['articulations', 'landmarks', 'fact'] as const) {
        expect(typeof b.info[k], `${b.slug}.${k}`).toBe('string')
        expect((b.info[k] ?? '').trim().length, `${b.slug}.${k}`).toBeGreaterThan(10)
      }
    }
  })
})
