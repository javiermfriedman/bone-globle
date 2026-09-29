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
        const isAnswer = g.slug === answer
        const color = heatToColor(g.heat, isAnswer)
        const fill = isAnswer ? 1 : Math.max(0.04, g.heat)
        return (
          <li
            key={g.slug}
            className={isAnswer ? 'found' : undefined}
            onClick={() => onSelect?.(g.slug)}
          >
            <span className="swatch" style={{ background: color, color }} />
            <span className="name">{getBone(g.slug).displayName}</span>
            <span className="heat-bar" aria-hidden>
              <span style={{ width: `${fill * 100}%`, background: color }} />
            </span>
          </li>
        )
      })}
    </ol>
  )
}
