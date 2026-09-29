import { getBone } from '../data/catalog'
import { heatToColor } from '../game/distance'
import { sortedByHeat, type Guess } from '../game/state'

interface Props {
  guesses: Guess[]
  answer: string
  onSelect?: (slug: string) => void
}

export function GuessList({ guesses, answer, onSelect }: Props) {
  if (guesses.length === 0) {
    return <div className="guess-list empty">No guesses yet. Type a bone name above.</div>
  }
  return (
    <ol className="guess-list">
      {sortedByHeat(guesses).map((g) => {
        const color = heatToColor(g.heat, g.slug === answer)
        return (
          <li key={g.slug} onClick={() => onSelect?.(g.slug)}>
            <span className="swatch" style={{ background: color }} />
            <span className="name">{getBone(g.slug).displayName}</span>
          </li>
        )
      })}
    </ol>
  )
}
