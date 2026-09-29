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
