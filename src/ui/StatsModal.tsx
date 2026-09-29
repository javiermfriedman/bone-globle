import { getBone } from '../data/catalog'
import { averageGuesses, hardestBones, type Stats } from '../game/stats'
import { Modal } from './Modal'

export function StatsModal({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  const hardest = hardestBones(stats, 5)
  return (
    <Modal title="Statistics" onClose={onClose}>
      <div className="stat-row">
        <div className="stat">
          <b>{stats.gamesPlayed}</b>
          <span>games</span>
        </div>
        <div className="stat">
          <b>{stats.gamesPlayed ? averageGuesses(stats).toFixed(1) : '–'}</b>
          <span>avg guesses</span>
        </div>
        <div className="stat">
          <b>{stats.totalGuesses}</b>
          <span>total guesses</span>
        </div>
      </div>
      <h3>Hardest bones</h3>
      {hardest.length === 0 ? (
        <p className="muted">Finish a game to see which bones took you longest.</p>
      ) : (
        <ol className="hardest">
          {hardest.map((h) => (
            <li key={h.slug}>
              <span>{getBone(h.slug).displayName}</span>
              <span className="muted">
                {h.avg.toFixed(1)} guesses{h.n > 1 ? ` × ${h.n}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}
