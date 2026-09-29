interface Props {
  gamesPlayed: number
  onHome: () => void
}

export function Header({ gamesPlayed, onHome }: Props) {
  return (
    <header className="header">
      <h1>
        Bone <span>Globle</span>
      </h1>
      <div className="header-right">
        <span className="muted">{gamesPlayed} played</span>
        <button title="Reset camera" onClick={onHome}>
          ⌂
        </button>
      </div>
    </header>
  )
}
