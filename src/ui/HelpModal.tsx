import { heatToColor } from '../game/distance'
import { Modal } from './Modal'

const SWATCHES = [0, 0.25, 0.5, 0.75, 1]

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose}>
      <p>
        A mystery bone is hidden somewhere in the skeleton. Type the name of any bone. Press Enter
        to check. If the spelling is close but not exact you get a short list of similar names to
        pick from; there are no hints while you type.
      </p>
      <p>
        Every guess lights up on the model. The colour tells you how close that bone is to the
        mystery bone, measured as straight-line distance between the bones themselves:
      </p>
      <div className="ramp">
        {SWATCHES.map((h) => (
          <span key={h} style={{ background: heatToColor(h) }} />
        ))}
        <span style={{ background: heatToColor(1, true) }} />
      </div>
      <div className="ramp-labels">
        <span>far</span>
        <span>close</span>
        <span>found</span>
      </div>
      <p>
        Paired bones count as one answer and both sides light up. Common names work too: kneecap,
        collarbone, C1, rib 2, thumb metacarpal, ilium. A leading left or right and a trailing
        &quot;bone&quot; are ignored.
      </p>
      <p>
        Drag to orbit, scroll to zoom, right-drag to pan. Unguessed bones are see-through so guesses
        inside the skull or chest still show.
      </p>
      <h3>Why this exists</h3>
      <img className="about-img" src="/chud.png" alt="My sister" />
      <p>I made this webapp for my chud sister so she can study for her anatomy class.</p>
      <p className="muted small">
        Skeleton model from BodyParts3D, © The Database Center for Life Science, CC BY 4.0.
      </p>
    </Modal>
  )
}
