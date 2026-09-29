import { groupBySubregion } from '../data/catalog'
import { Modal } from './Modal'

interface Props {
  slugs: string[]
  onClose: () => void
}

export function BoneListModal({ slugs, onClose }: Props) {
  const groups = groupBySubregion(slugs)

  return (
    <Modal title={`All bones · ${slugs.length}`} onClose={onClose}>
      <div className="bone-groups">
        {groups.map((g) => (
          <section key={g.key}>
            <h3>
              {g.label} <span className="muted small">{g.bones.length}</span>
            </h3>
            <ul className="bone-list">
              {g.bones.map((b) => (
                <li key={b.slug}>{b.displayName}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
