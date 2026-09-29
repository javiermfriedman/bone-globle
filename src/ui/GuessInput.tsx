import { useEffect, useRef, useState } from 'react'
import type { SearchHit, SearchIndex } from '../data/search'

interface Props {
  index: SearchIndex
  guessed: Set<string>
  disabled?: boolean
  placeholder?: string
  onGuess: (slug: string) => void
}

export function GuessInput({ index, guessed, disabled, placeholder, onGuess }: Props) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<SearchHit[]>([])
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  const submit = (slug: string | null) => {
    if (!slug) {
      setError('Not a bone in this game')
      return
    }
    if (guessed.has(slug)) {
      setError('Already guessed')
      return
    }
    onGuess(slug)
    setQuery('')
    setOpen(false)
    setCandidates([])
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!open) return
      e.preventDefault()
      setActive((a) => Math.min(candidates.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      if (!open) return
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && candidates[active]) {
        submit(candidates[active].slug)
        return
      }
      const exact = index.resolve(query)
      if (exact) {
        submit(exact.slug)
        return
      }
      const near = index.search(query, 8).filter((h) => !guessed.has(h.slug))
      if (near.length === 0) {
        setError('No close matches')
        return
      }
      setCandidates(near)
      setActive(0)
      setOpen(true)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="guess-input">
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder ?? 'Guess a bone…'}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setError(null)
          setOpen(false)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        aria-expanded={open && candidates.length > 0}
      />
      {error && <div className="guess-error">{error}</div>}
      {open && candidates.length > 0 && (
        <>
          <div className="muted small">Did you mean…</div>
          <ul className="suggestions" role="listbox">
            {candidates.map((h, i) => (
              <li
                key={h.slug}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                onMouseDown={(e) => {
                  e.preventDefault()
                  submit(h.slug)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span>{h.displayName}</span>
                {h.term !== h.displayName.toLowerCase() && <small>{h.term}</small>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
