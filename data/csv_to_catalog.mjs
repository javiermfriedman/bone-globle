#!/usr/bin/env node
// Converts data/bone_catalog_draft.csv -> data/bone_catalog.json
// No dependencies. Run: node data/csv_to_catalog.mjs
//
// Also enriches synonyms with practical alternate forms (vertebra shorthands,
// rib ordinals, digit-number forms for metacarpals/metatarsals/phalanges) and
// prints a verification summary.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = dirname(fileURLToPath(import.meta.url))
const CSV_PATH = join(DATA_DIR, 'bone_catalog_draft.csv')
const JSON_PATH = join(DATA_DIR, 'bone_catalog.json')

/* ------------------------------------------------------------------ CSV --- */

/** RFC4180-ish parser: handles quoted fields, embedded commas, "" escapes, CRLF. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      pushField()
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      pushRow()
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length > 0 || row.length > 0) pushRow()
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

const splitPipe = (s) =>
  (s ?? '')
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)
const toBool = (s) => String(s).trim().toLowerCase() === 'true'

/* ------------------------------------------------------- synonym helpers --- */

const ORD = [
  null,
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
]
const ordSuffix = (n) => {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

// Extra common / clinical names, keyed by slug.
const EXTRA = {
  'frontal-bone': ['forehead bone'],
  'occipital-bone': ['back of the skull'],
  'sphenoid-bone': ['wasp bone'],
  maxilla: ['upper jaw', 'upper jawbone'],
  'zygomatic-bone': ['cheekbone', 'cheek bone', 'malar bone', 'zygoma'],
  'nasal-bone': ['bridge of the nose'],
  'lacrimal-bone': ['tear bone'],
  mandible: ['jawbone', 'jaw bone', 'lower jaw', 'lower jawbone'],
  hyoid: ['tongue bone'],
  sacrum: ['sacral bone'],
  coccyx: ['tailbone', 'tail bone'],
  sternum: ['breastbone', 'breast bone', 'manubrium', 'xiphoid process'],
  clavicle: ['collarbone', 'collar bone'],
  scapula: ['shoulder blade', 'shoulderblade'],
  humerus: ['upper arm bone', 'arm bone'],
  patella: ['kneecap', 'knee cap'],
  femur: ['thigh bone', 'thighbone'],
  tibia: ['shin bone', 'shinbone'],
  fibula: ['calf bone'],
  'tarsal-calcaneus': ['heel bone', 'heelbone'],
  'tarsal-talus': ['ankle bone', 'anklebone', 'astragalus'],
  'hip-bone': ['hipbone', 'os coxae', 'innominate bone'],
  'carpal-scaphoid': ['navicular of the hand'],
  'metacarpal-1': ['thumb metacarpal', 'metacarpal of the thumb'],
  'metacarpal-2': ['index finger metacarpal'],
  'metacarpal-3': ['middle finger metacarpal'],
  'metacarpal-4': ['ring finger metacarpal'],
  'metacarpal-5': ['little finger metacarpal', 'pinky metacarpal'],
  'metatarsal-1': ['great toe metatarsal', 'big toe metatarsal'],
  'metatarsal-5': ['little toe metatarsal', 'pinky toe metatarsal'],
}

// Synonyms to drop: "funny bone" is the ulnar nerve, not a bone.
const BANNED = new Set(['funny bone', 'pelvis'])

const VERT_GROUPS = {
  c: { word: 'cervical', alt: [] },
  t: { word: 'thoracic', alt: ['th'] },
  l: { word: 'lumbar', alt: [] },
}

const VERT_SPECIAL = {
  'vertebra-c1': ['atlas'],
  'vertebra-c2': ['axis', 'epistropheus'],
  'vertebra-c7': ['vertebra prominens'],
}

/** Generated alternate forms for a slug. */
function generatedSynonyms(slug) {
  const out = []

  let m = /^vertebra-([ctl])(\d+)$/.exec(slug)
  if (m) {
    const [, letter, num] = m
    const n = Number(num)
    const { word, alt } = VERT_GROUPS[letter]
    out.push(`${letter}${n}`, `${letter}-${n}`, `${word} ${n}`)
    for (const a of alt) out.push(`${a}${n}`)
    if (ORD[n]) out.push(`${ORD[n]} ${word} vertebra`)
    out.push(`${word} vertebra ${n}`)
    out.push(...(VERT_SPECIAL[slug] ?? []))
    return out
  }

  m = /^rib-0?(\d+)$/.exec(slug)
  if (m) {
    const n = Number(m[1])
    out.push(`rib ${n}`, `${ordSuffix(n)} rib`)
    if (ORD[n]) out.push(`${ORD[n]} rib`)
    return out
  }

  m = /^(metacarpal|metatarsal)-(\d+)$/.exec(slug)
  if (m) {
    const kind = m[1]
    const n = Number(m[2])
    const abbr = kind === 'metacarpal' ? 'mc' : 'mt'
    out.push(`${kind} ${n}`, `${ordSuffix(n)} ${kind}`)
    if (ORD[n]) out.push(`${ORD[n]} ${kind}`)
    out.push(`${abbr}${n}`, `${kind} bone ${n}`)
    return out
  }

  return out
}

/** Strip the "index finger finger" style duplication in the draft CSV. */
const fixDoubling = (s) =>
  s
    .replace(/\b(finger|toe)\s+\1\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

function buildSynonyms(slug, rawSynonyms, displayName) {
  const seen = new Set()
  const out = []
  const add = (raw) => {
    const s = fixDoubling(String(raw).toLowerCase().trim())
    if (!s || BANNED.has(s) || seen.has(s)) return
    seen.add(s)
    out.push(s)
  }
  // Generated forms first for the numbered families (they are the ones people type).
  const gen = generatedSynonyms(slug)
  gen.forEach(add)
  rawSynonyms.forEach(add)
  ;(EXTRA[slug] ?? []).forEach(add)
  // displayName is intentionally NOT required here; search adds it.
  void displayName
  return out.slice(0, 10)
}

/* --------------------------------------------------------------- convert --- */

const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'))
const header = rows[0].map((h) => h.trim())
const idx = Object.fromEntries(header.map((h, i) => [h, i]))
const required = [
  'slug',
  'display_name',
  'synonyms',
  'region',
  'subregion',
  'paired',
  'optional',
  'bp3d_name_pattern',
  'count_in_body',
]
for (const col of required) {
  if (!(col in idx)) throw new Error(`CSV missing column: ${col}`)
}

const entries = rows.slice(1).map((r) => {
  const slug = r[idx.slug].trim()
  return {
    slug,
    displayName: r[idx.display_name].trim(),
    synonyms: buildSynonyms(slug, splitPipe(r[idx.synonyms]), r[idx.display_name]),
    region: r[idx.region].trim(),
    subregion: r[idx.subregion].trim(),
    paired: toBool(r[idx.paired]),
    optional: toBool(r[idx.optional]),
    meshNames: splitPipe(r[idx.bp3d_name_pattern]),
    info: {},
    _countInBody: Number(r[idx.count_in_body]),
  }
})

/* ------------------------------------------------------------- verifying --- */

const problems = []
const suspicious = []

if (entries.length !== 120) problems.push(`expected 120 entries, got ${entries.length}`)

const slugSeen = new Map()
for (const e of entries) {
  if (slugSeen.has(e.slug)) problems.push(`duplicate slug: ${e.slug}`)
  slugSeen.set(e.slug, e)
  if (e.meshNames.length === 0) problems.push(`${e.slug}: empty meshNames`)
  if (e.paired && e.meshNames.length < 2) {
    problems.push(`${e.slug}: paired but ${e.meshNames.length} meshName(s)`)
  }
  if (e.synonyms.length === 0) problems.push(`${e.slug}: no synonyms`)

  // Heuristics for names that do not look like BodyParts3D English names.
  for (const name of e.meshNames) {
    const why = []
    if (name !== name.toLowerCase()) why.push('not lowercase')
    if (/\d/.test(name)) why.push('contains a digit (BP3D spells ordinals as words)')
    if (/(^|\s)(left|right)(\s|$)/.test(name) && !/^(left|right) /.test(name)) {
      why.push('laterality not a leading word')
    }
    if (!/^(left|right) /.test(name) && e.paired && !/\b(left|right)\b/.test(name)) {
      why.push('paired entry but mesh name carries no laterality')
    }
    if (why.length) suspicious.push({ slug: e.slug, meshName: name, why })
  }
  // Mesh count vs. count_in_body
  if (Number.isFinite(e._countInBody) && e.meshNames.length !== e._countInBody) {
    suspicious.push({
      slug: e.slug,
      meshName: e.meshNames.join(' | '),
      why: [`${e.meshNames.length} mesh name(s) but count_in_body=${e._countInBody}`],
    })
  }
}

// Known semantic risks the heuristics above cannot see.
const MANUAL_FLAGS = [
  [
    'sternum',
    'CSV maps to a single mesh "sternum"; BodyParts3D likely splits it into ' +
      '"manubrium of sternum" / "body of sternum" / "xiphoid process" (3 meshes, unpaired).',
  ],
  [
    'hip-bone',
    'CSV has both "left/right hip bone" AND optional ilium/ischium/pubis rows. ' +
      'BodyParts3D provides one or the other, not both — drop whichever is absent.',
  ],
  ['ilium', 'Optional row; only valid if BodyParts3D splits the hip bone.'],
  ['ischium', 'Optional row; only valid if BodyParts3D splits the hip bone.'],
  ['pubis', 'Optional row; only valid if BodyParts3D splits the hip bone.'],
  [
    'tarsal-navicular',
    'Mesh "left/right navicular bone of foot" — BodyParts3D may just say ' +
      '"left navicular bone"; the hand scaphoid has no "of hand" qualifier here.',
  ],
  [
    'tarsal-cuboid',
    'Mesh "left/right cuboid" has no "bone" suffix while its cuneiform ' +
      'neighbours do ("left medial cuneiform bone"); one of the two is probably wrong.',
  ],
  [
    'carpal-scaphoid',
    'Carpals are bare ("left scaphoid", "left lunate", ...) while tarsal ' +
      'cuneiforms carry "bone". Verify the suffix convention per bone.',
  ],
  ['sacrum', 'BodyParts3D may expose the sacrum as five fused "first sacral vertebra" ... meshes.'],
  ['coccyx', 'BodyParts3D may expose the coccyx as separate coccygeal segments.'],
]

const out = entries.map(({ _countInBody, ...e }) => e)
writeFileSync(JSON_PATH, JSON.stringify(out, null, 2) + '\n')

/* --------------------------------------------------------------- summary --- */

const by = (fn) => {
  const m = new Map()
  for (const e of entries) m.set(fn(e), (m.get(fn(e)) ?? 0) + 1)
  return [...m.entries()]
}

console.log(`wrote ${JSON_PATH}`)
console.log(`entries: ${entries.length}`)
console.log(`unique slugs: ${slugSeen.size}`)
console.log(`total mesh names: ${entries.reduce((a, e) => a + e.meshNames.length, 0)}`)
console.log(
  `paired: ${entries.filter((e) => e.paired).length}  unpaired: ${entries.filter((e) => !e.paired).length}`,
)
console.log(`optional: ${entries.filter((e) => e.optional).length}`)
console.log('\nby region:')
for (const [k, v] of by((e) => e.region)) console.log(`  ${k}: ${v}`)
console.log('\nby subregion:')
for (const [k, v] of by((e) => e.subregion)) console.log(`  ${k}: ${v}`)
console.log(
  `\nsynonyms: min=${Math.min(...entries.map((e) => e.synonyms.length))} max=${Math.max(...entries.map((e) => e.synonyms.length))}`,
)

// Collapse the big uniform class so the summary stays readable.
const infix = suspicious.filter(
  (s) => s.why.length === 1 && s.why[0] === 'laterality not a leading word',
)
const rest = suspicious.filter((s) => !infix.includes(s))
console.log(`\nsuspicious mesh names (${suspicious.length}):`)
if (infix.length) {
  console.log(
    `  [${infix.length}] infix laterality, e.g. "proximal phalanx of left thumb", ` +
      '"first metacarpal bone of left hand" — plausible BodyParts3D form for hand/foot bones, ' +
      'but it breaks the "leading left/right" rule the rest of the catalog follows. Verify.',
  )
  const slugs = [...new Set(infix.map((s) => s.slug))]
  console.log(`       affected slugs (${slugs.length}): ${slugs.join(', ')}`)
}
for (const s of rest) console.log(`  ${s.slug}  "${s.meshName}"  -> ${s.why.join('; ')}`)

console.log(`\nmanual flags for the reconciliation agent (${MANUAL_FLAGS.length}):`)
for (const [slug, note] of MANUAL_FLAGS) console.log(`  ${slug}: ${note}`)

console.log(`\nproblems (${problems.length}):`)
for (const p of problems) console.log(`  ${p}`)
if (problems.length) process.exitCode = 1
