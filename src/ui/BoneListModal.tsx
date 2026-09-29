import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { bySlug, groupBySubregion, type BoneEntry } from '../data/catalog'
import { filterBones, summarizeBones } from '../data/boneFilter'
import { Modal } from './Modal'

interface Props {
  slugs: string[]
  onClose: () => void
}

export function BoneListModal({ slugs, onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const entries = useMemo(
    () => slugs.map((s) => bySlug.get(s)).filter((b): b is BoneEntry => b !== undefined),
    [slugs],
  )
  const summary = useMemo(() => summarizeBones(entries), [entries])
  const matches = useMemo(() => filterBones(entries, query), [entries, query])
  const via = new Map(matches.filter((m) => m.via).map((m) => [m.bone.slug, m.via!]))
  const groups = groupBySubregion(matches.map((m) => m.bone.slug))
  const filtering = query.trim() !== ''

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // With text, Escape clears the filter; stopPropagation keeps Modal's window
    // listener from also closing. With an empty filter it bubbles and closes.
    if (e.key === 'Escape' && query !== '') {
      e.stopPropagation()
      setQuery('')
    }
  }

  return (
    <Modal title={`All bones · ${summary.total}`} onClose={onClose}>
      <p className="bone-summary">
        {summary.total} bones to find: {summary.axial} axial, {summary.appendicular} appendicular.{' '}
        <span className="muted">
          Paired bones ({summary.paired}) count once, and either side is accepted.
        </span>
      </p>
      <div className="bone-filter">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Filter bones…"
          aria-label="Filter bones"
          autoComplete="off"
          spellCheck={false}
        />
        {filtering && (
          <div className="muted small bone-filter-count">
            Showing {matches.length} of {summary.total}
          </div>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="muted small bone-empty">No bones match “{query.trim()}”.</p>
      ) : (
        <div className="bone-groups">
          {groups.map((g) => (
            <section key={g.key}>
              <h3>
                {g.label} <span className="muted small">{g.bones.length}</span>
              </h3>
              <ul className="bone-list">
                {g.bones.map((b) => (
                  <li key={b.slug}>
                    {b.displayName}
                    {via.has(b.slug) && <small className="muted"> · {via.get(b.slug)}</small>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Modal>
  )
}
