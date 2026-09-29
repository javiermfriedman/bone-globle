import rawCatalog from '../../data/bone_catalog.json'

export type Region = 'axial' | 'appendicular'

export interface BoneInfo {
  articulations?: string
  landmarks?: string
  fact?: string
}

export interface BoneEntry {
  slug: string
  displayName: string
  synonyms: string[]
  region: Region
  subregion: string
  paired: boolean
  optional: boolean
  meshNames: string[]
  info: BoneInfo
}

export interface BoneGeometry {
  centroids: [number, number, number][]
  bboxCenter: [number, number, number]
  radius: number
}

export interface Geometry {
  unit: 'm'
  maxDistance: number
  bones: Record<string, BoneGeometry>
  distance: Record<string, Record<string, number>>
}

export const catalog: BoneEntry[] = rawCatalog as BoneEntry[]

export const bySlug: Map<string, BoneEntry> = new Map(catalog.map((b) => [b.slug, b]))

/** Mesh node name -> catalog slug (a slug may own several meshes). */
export const slugByMeshName: Map<string, string> = new Map(
  catalog.flatMap((b) => b.meshNames.map((m) => [m, b.slug] as [string, string])),
)

export function getBone(slug: string): BoneEntry {
  const b = bySlug.get(slug)
  if (!b) throw new Error(`Unknown bone slug: ${slug}`)
  return b
}

let geometryPromise: Promise<Geometry> | null = null

/** Fetches public/data/geometry.json once. */
export function loadGeometry(): Promise<Geometry> {
  if (!geometryPromise) {
    geometryPromise = fetch('/data/geometry.json').then(async (r) => {
      if (!r.ok) throw new Error(`geometry.json: HTTP ${r.status}`)
      return (await r.json()) as Geometry
    })
  }
  return geometryPromise
}

/** Anatomical subregions in rough top-to-bottom order, for grouped listings. */
export const SUBREGION_ORDER: { key: string; label: string }[] = [
  { key: 'skull', label: 'Skull' },
  { key: 'neck', label: 'Hyoid' },
  { key: 'vertebral-column', label: 'Vertebral column' },
  { key: 'thoracic-cage', label: 'Thoracic cage' },
  { key: 'shoulder-girdle', label: 'Shoulder girdle' },
  { key: 'arm', label: 'Arm' },
  { key: 'forearm', label: 'Forearm' },
  { key: 'hand', label: 'Hand' },
  { key: 'pelvic-girdle', label: 'Pelvic girdle' },
  { key: 'thigh', label: 'Thigh' },
  { key: 'leg', label: 'Leg' },
  { key: 'foot', label: 'Foot' },
]

/**
 * Groups the given slugs by subregion, ordered by SUBREGION_ORDER and, within a
 * group, by catalog order. Empty groups are omitted; unknown subregions are
 * appended last, labelled with their raw key.
 */
export function groupBySubregion(
  slugs: string[],
): { key: string; label: string; bones: BoneEntry[] }[] {
  const wanted = new Set(slugs)
  const buckets = new Map<string, BoneEntry[]>()
  for (const b of catalog) {
    if (!wanted.has(b.slug)) continue
    const bucket = buckets.get(b.subregion)
    if (bucket) bucket.push(b)
    else buckets.set(b.subregion, [b])
  }

  const known = new Set(SUBREGION_ORDER.map((s) => s.key))
  const extras = [...buckets.keys()].filter((k) => !known.has(k)).map((k) => ({ key: k, label: k }))

  return [...SUBREGION_ORDER, ...extras].flatMap(({ key, label }) => {
    const bones = buckets.get(key)
    return bones && bones.length > 0 ? [{ key, label, bones }] : []
  })
}
