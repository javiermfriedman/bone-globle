import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hits = useMemo<SearchHit[]>(() => index.search(query, 8), [index, query])

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
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(hits.length - 1, a + 1))
      setOpen(true)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const exact = index.resolve(query)
      const pick = exact ?? (open ? hits[active] : undefined) ?? hits[0] ?? null
      submit(pick?.slug ?? null)
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
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-expanded={open && hits.length > 0}
      />
      {error && <div className="guess-error">{error}</div>}
      {open && hits.length > 0 && (
        <ul className="suggestions" role="listbox">
          {hits.map((h, i) => {
            const done = guessed.has(h.slug)
            return (
              <li
                key={h.slug}
                role="option"
                aria-selected={i === active}
                className={[i === active ? 'active' : '', done ? 'done' : ''].join(' ')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (!done) submit(h.slug)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span>{h.displayName}</span>
                {h.term !== h.displayName.toLowerCase() && <small>{h.term}</small>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
