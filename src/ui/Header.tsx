interface Props {
  onHelp: () => void
  onBones: () => void
  onHome: () => void
}

const ICON = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function Header({ onHelp, onBones, onHome }: Props) {
  return (
    <header className="header">
      <h1 className="brand">
        Bone <span>Globle</span>
      </h1>
      <div className="header-right">
        <button
          className="icon-btn"
          title="Reset camera"
          aria-label="Reset camera"
          onClick={onHome}
        >
          <svg {...ICON}>
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V20h14V9.5" />
          </svg>
        </button>
        <button className="icon-btn" title="All bones" aria-label="All bones" onClick={onBones}>
          <svg {...ICON}>
            <path d="M8 6h13M8 12h13M8 18h13" />
            <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth={2.6} />
          </svg>
        </button>
        <button className="icon-btn" title="How to play" aria-label="How to play" onClick={onHelp}>
          <svg {...ICON}>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8" />
            <path d="M12 17.2h.01" strokeWidth={2.6} />
          </svg>
        </button>
      </div>
    </header>
  )
}
