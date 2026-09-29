interface Props {
  onHelp: () => void
  onStats: () => void
  onHome: () => void
}

export function Header({ onHelp, onStats, onHome }: Props) {
  return (
    <header className="header">
      <h1>
        Bone <span>Globle</span>
      </h1>
      <div className="header-right">
        <button title="Reset camera" aria-label="Reset camera" onClick={onHome}>
          ⌂
        </button>
        <button title="Statistics" aria-label="Statistics" onClick={onStats}>
          ▥
        </button>
        <button title="How to play" aria-label="How to play" onClick={onHelp}>
          ?
        </button>
      </div>
    </header>
  )
}
