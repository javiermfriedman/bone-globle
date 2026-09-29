import { getBone } from '../data/catalog'

interface Props {
  answer: string
  guessCount: number
  onPlayAgain: () => void
}

export function WinCard({ answer, guessCount, onPlayAgain }: Props) {
  const bone = getBone(answer)
  const region = `${bone.region} · ${bone.subregion.replace(/-/g, ' ')}`
  return (
    <div className="win-card" role="dialog" aria-label="You found the bone">
      <div className="win-eyebrow">
        <span className="win-dot" />
        Found in {guessCount} {guessCount === 1 ? 'guess' : 'guesses'}
      </div>
      <div className="win-title">
        {bone.displayName}
        <small>{region}</small>
      </div>
      {bone.info.articulations && (
        <p>
          <b>Articulates with</b>
          {bone.info.articulations}
        </p>
      )}
      {bone.info.landmarks && (
        <p>
          <b>Landmarks</b>
          {bone.info.landmarks}
        </p>
      )}
      {bone.info.fact && <p className="win-fact">{bone.info.fact}</p>}
      <button className="primary" onClick={onPlayAgain} autoFocus>
        Play again
      </button>
    </div>
  )
}
