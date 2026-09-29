import { SUBREGION_ORDER, type BoneEntry } from './catalog'
import { normalize } from './search'

export interface BoneMatch {
  bone: BoneEntry
  /** Set when the bone matched only through this synonym (not its name or group). */
  via?: string
}

const subregionLabel = new Map(SUBREGION_ORDER.map((s) => [s.key, s.label]))

/**
 * Live filter for the all-bones directory: case- and punctuation-insensitive substring
 * match against the display name, synonyms and subregion label. An empty query keeps
 * every entry. Input order is preserved.
 */
export function filterBones(entries: BoneEntry[], query: string): BoneMatch[] {
  const q = normalize(query)
  if (!q) return entries.map((bone) => ({ bone }))
  const out: BoneMatch[] = []
  for (const bone of entries) {
    const label = subregionLabel.get(bone.subregion) ?? bone.subregion
    if (normalize(bone.displayName).includes(q) || normalize(label).includes(q)) {
      out.push({ bone })
      continue
    }
    const via = bone.synonyms.find((s) => normalize(s).includes(q))
    if (via) out.push({ bone, via })
  }
  return out
}

/** Counts for the directory summary line. */
export function summarizeBones(entries: BoneEntry[]) {
  return {
    total: entries.length,
    axial: entries.filter((b) => b.region === 'axial').length,
    appendicular: entries.filter((b) => b.region === 'appendicular').length,
    paired: entries.filter((b) => b.paired).length,
  }
}
