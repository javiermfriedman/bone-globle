/**
 * 05_derive.ts — read public/models/skeleton.glb plus data/bone_catalog.json and emit
 * public/data/geometry.json (per-answer centroids, bounds, and the pairwise distance matrix).
 *
 * Run with `npm run derive`. Fails loudly (exit 1) if any catalog meshName is missing from
 * the GLB, or if any GLB mesh node is neither mapped by the catalog nor in
 * data/ignored_meshes.json.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO, type Node as GltfNode } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const GLB = resolve(ROOT, 'public/models/skeleton.glb')
const CATALOG = resolve(ROOT, 'data/bone_catalog.json')
const IGNORED = resolve(ROOT, 'data/ignored_meshes.json')
const OUT = resolve(ROOT, 'public/data/geometry.json')

type Vec3 = [number, number, number]

interface CatalogEntry {
  slug: string
  displayName: string
  paired: boolean
  optional: boolean
  meshNames: string[]
}

interface MeshStats {
  centroid: Vec3
  min: Vec3
  max: Vec3
}

function fail(message: string): never {
  console.error(`\n05_derive: ${message}\n`)
  process.exit(1)
}

/** Applies a column-major 4x4 matrix to a point. */
function transform(m: number[] | null, [x, y, z]: Vec3): Vec3 {
  if (!m) return [x, y, z]
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ]
}

function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      out[c * 4 + r] = s
    }
  }
  return out
}

/** World matrix of a node: parent chain local matrices multiplied together. */
function worldMatrix(node: GltfNode): number[] {
  const chain: number[][] = []
  let cur: GltfNode | null = node
  while (cur) {
    chain.push(Array.from(cur.getMatrix()))
    const parent = cur.getParentNode?.()
    cur = parent ?? null
  }
  let m = chain[chain.length - 1]
  for (let i = chain.length - 2; i >= 0; i--) m = multiply(m, chain[i])
  return m
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4
}

async function main() {
  await MeshoptDecoder.ready
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

  const document = await io.read(GLB)
  const root = document.getRoot()

  // ---- per-mesh-node centroid + AABB, in world space ------------------------------------
  const stats = new Map<string, MeshStats>()
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const name = node.getName()
    if (stats.has(name)) fail(`duplicate mesh node name in GLB: "${name}"`)

    const m = worldMatrix(node)
    let sx = 0
    let sy = 0
    let sz = 0
    let count = 0
    const min: Vec3 = [Infinity, Infinity, Infinity]
    const max: Vec3 = [-Infinity, -Infinity, -Infinity]

    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const el: number[] = [0, 0, 0]
      for (let i = 0, n = pos.getCount(); i < n; i++) {
        // getElement() de-quantizes normalized integer accessors for us.
        pos.getElement(i, el)
        const p = transform(m, [el[0], el[1], el[2]])
        sx += p[0]
        sy += p[1]
        sz += p[2]
        count++
        for (let a = 0; a < 3; a++) {
          if (p[a] < min[a]) min[a] = p[a]
          if (p[a] > max[a]) max[a] = p[a]
        }
      }
    }
    if (count === 0) fail(`mesh node "${name}" has no POSITION data`)
    stats.set(name, { centroid: [sx / count, sy / count, sz / count], min, max })
  }

  console.log(`GLB mesh nodes: ${stats.size}`)

  // ---- sanity: everything inside the skeleton bounding box -------------------------------
  const world: { min: Vec3; max: Vec3 } = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  }
  for (const s of stats.values()) {
    for (let a = 0; a < 3; a++) {
      if (s.min[a] < world.min[a]) world.min[a] = s.min[a]
      if (s.max[a] > world.max[a]) world.max[a] = s.max[a]
    }
  }
  console.log(
    `skeleton bbox: min [${world.min.map(round4).join(', ')}]  max [${world.max.map(round4).join(', ')}]`,
  )
  const LIMIT: Vec3 = [0.5, 1.1, 0.3] // generous envelope around the expected ±0.33/±0.86/±0.13
  for (const [name, s] of stats) {
    for (let a = 0; a < 3; a++) {
      if (Math.abs(s.centroid[a]) > LIMIT[a]) {
        fail(
          `centroid of "${name}" is outside the expected skeleton envelope: ` +
            `[${s.centroid.map(round4).join(', ')}]`,
        )
      }
    }
  }

  // ---- reconcile with the catalog --------------------------------------------------------
  const catalog: CatalogEntry[] = JSON.parse(readFileSync(CATALOG, 'utf8'))
  const ignored: string[] = JSON.parse(readFileSync(IGNORED, 'utf8')).ignored

  const owner = new Map<string, string>()
  const missing: string[] = []
  for (const entry of catalog) {
    for (const meshName of entry.meshNames) {
      if (!stats.has(meshName)) missing.push(`${entry.slug} -> "${meshName}"`)
      const prev = owner.get(meshName)
      if (prev) fail(`mesh "${meshName}" is claimed by both "${prev}" and "${entry.slug}"`)
      owner.set(meshName, entry.slug)
    }
  }
  if (missing.length) {
    fail(`catalog meshNames missing from the GLB:\n  ${missing.join('\n  ')}`)
  }

  const ignoredSet = new Set(ignored)
  const bogusIgnores = ignored.filter((n) => !stats.has(n))
  if (bogusIgnores.length) {
    fail(`ignored_meshes.json names that do not exist in the GLB:\n  ${bogusIgnores.join('\n  ')}`)
  }
  const both = ignored.filter((n) => owner.has(n))
  if (both.length) {
    fail(`mesh names that are both mapped and ignored:\n  ${both.join('\n  ')}`)
  }
  const orphans = [...stats.keys()].filter((n) => !owner.has(n) && !ignoredSet.has(n))
  if (orphans.length) {
    fail(`GLB mesh nodes that are neither mapped nor ignored:\n  ${orphans.join('\n  ')}`)
  }
  console.log(
    `mapped: ${owner.size}   ignored: ${ignored.length}   total: ${owner.size + ignored.length}`,
  )

  // ---- geometry --------------------------------------------------------------------------
  const entries = catalog.filter((e) => e.meshNames.length > 0)
  const skipped = catalog.filter((e) => e.meshNames.length === 0)
  if (skipped.length) {
    console.log(`skipping entries with no meshes: ${skipped.map((e) => e.slug).join(', ')}`)
  }

  const bones: Record<string, { centroids: Vec3[]; bboxCenter: Vec3; radius: number }> = {}
  const centroidsBySlug = new Map<string, Vec3[]>()

  for (const entry of entries) {
    const parts = entry.meshNames.map((n) => stats.get(n)!)
    const centroids = parts.map((p) => p.centroid)
    centroidsBySlug.set(entry.slug, centroids)

    const min: Vec3 = [Infinity, Infinity, Infinity]
    const max: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const p of parts) {
      for (let a = 0; a < 3; a++) {
        if (p.min[a] < min[a]) min[a] = p.min[a]
        if (p.max[a] > max[a]) max[a] = p.max[a]
      }
    }
    const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2])
    bones[entry.slug] = {
      centroids: centroids.map((c) => c.map(round4) as Vec3),
      bboxCenter: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2].map(
        round4,
      ) as Vec3,
      radius: round4(diag / 2),
    }
  }

  // ---- distance matrix: min over all centroid pairs ---------------------------------------
  const slugs = entries.map((e) => e.slug)
  const distance: Record<string, Record<string, number>> = {}
  for (const s of slugs) distance[s] = { [s]: 0 }

  let maxDistance = 0
  for (let i = 0; i < slugs.length; i++) {
    const a = centroidsBySlug.get(slugs[i])!
    for (let j = i + 1; j < slugs.length; j++) {
      const b = centroidsBySlug.get(slugs[j])!
      let best = Infinity
      for (const p of a) {
        for (const q of b) {
          const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
          if (d < best) best = d
        }
      }
      const d = round4(best)
      distance[slugs[i]][slugs[j]] = d
      distance[slugs[j]][slugs[i]] = d
      if (d > maxDistance) maxDistance = d
    }
  }

  const geometry = { unit: 'm', maxDistance: round4(maxDistance), bones, distance }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(geometry) + '\n')

  // ---- report ------------------------------------------------------------------------------
  const kb = (statSync(OUT).size / 1024).toFixed(1)
  console.log(`\nwrote ${OUT} (${kb} KB)`)
  console.log(`answers with geometry: ${slugs.length}`)
  console.log(`maxDistance: ${geometry.maxDistance} m`)

  const sample = (a: string, b: string) => console.log(`  ${a} <-> ${b}: ${distance[a]?.[b]} m`)
  console.log('sanity distances:')
  sample('femur', 'patella')
  sample('femur', 'frontal-bone')
  sample('mandible', 'hyoid')
  sample('femur', 'tibia')

  for (const slug of ['femur', 'humerus', 'scapula', 'tarsal-calcaneus']) {
    const c = bones[slug].centroids
    const xs = c.map((p) => p[0])
    const ok = xs.some((x) => x > 0) && xs.some((x) => x < 0)
    const ySpread = Math.max(...c.map((p) => p[1])) - Math.min(...c.map((p) => p[1]))
    const zSpread = Math.max(...c.map((p) => p[2])) - Math.min(...c.map((p) => p[2]))
    console.log(
      `symmetry ${slug}: x = [${xs.map(round4).join(', ')}] ${ok ? 'OK' : 'FAIL'}` +
        `  y spread ${round4(ySpread)}  z spread ${round4(zSpread)}`,
    )
    if (!ok) fail(`paired bone "${slug}" does not straddle x = 0`)
  }

  const hy = bones['hyoid'].centroids
  console.log(`hyoid centroids: ${hy.map((c) => `[${c.join(', ')}]`).join('  ')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
