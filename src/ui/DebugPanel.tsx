import { useState } from 'react'
import { catalog } from '../data/catalog'
import type { BoneColors } from '../three/Skeleton'

interface Props {
  colors: BoneColors
  onChange: (colors: BoneColors) => void
  onFlyTo: (slug: string) => void
}

/** Dev-only panel: type a slug, pick a color, highlight it. */
export function DebugPanel({ colors, onChange, onFlyTo }: Props) {
  const [slug, setSlug] = useState('')
  const [color, setColor] = useState('#ff4d3d')
  const valid = catalog.some((b) => b.slug === slug)
  return (
    <div className="debug-panel">
      <strong>Debug</strong>
      <input
        list="slugs"
        placeholder="slug (e.g. patella)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />
      <datalist id="slugs">
        {catalog.map((b) => (
          <option key={b.slug} value={b.slug} />
        ))}
      </datalist>
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      <button disabled={!valid} onClick={() => onChange({ ...colors, [slug]: color })}>
        Color
      </button>
      <button disabled={!valid} onClick={() => onFlyTo(slug)}>
        Fly
      </button>
      <button onClick={() => onChange({})}>Reset</button>
      <div className="debug-list">
        {Object.entries(colors).map(([s, c]) => (
          <span key={s} style={{ color: c }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
