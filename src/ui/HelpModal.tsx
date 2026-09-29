import { heatToColor } from '../game/distance'
import { Modal } from './Modal'

const RAMP_CSS = `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => heatToColor(i / 10)).join(', ')})`

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose}>
      <p>
        A mystery bone is hidden somewhere in the skeleton. Type the name of any bone. Press Enter
        to check. If you misspell a name by a letter or two you get a &ldquo;Did you mean&rdquo;
        prompt to confirm; partial or distant names get no suggestions, and there are no hints while
        you type.
      </p>
      <p>
        Every guess lights up on the model. The colour tells you how close that bone is to the
        mystery bone, measured as straight-line distance between the bones themselves:
      </p>
      <div className="ramp">
        <span className="ramp-heat" style={{ background: RAMP_CSS }} />
        <span className="ramp-win" style={{ background: heatToColor(1, true) }} />
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
