import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { catalog, loadGeometry, type Geometry } from './data/catalog'
import { SearchIndex } from './data/search'
import { heatToColor } from './game/distance'
import { pickAnswer, pushRecent, readRecent } from './game/random'
import { initialState, reduce, type GameState } from './game/state'
import type { BoneColors } from './three/Skeleton'
import { BoneListModal } from './ui/BoneListModal'
import { DebugPanel } from './ui/DebugPanel'
import { GuessInput } from './ui/GuessInput'
import { GuessList } from './ui/GuessList'
import { Header } from './ui/Header'
import { HelpModal } from './ui/HelpModal'
import { WinCard } from './ui/WinCard'

const ANSWER_POOL = catalog.filter((b) => !b.optional && b.meshNames.length > 0).map((b) => b.slug)
// Lazy so the UI shell paints before the three.js bundle arrives.
const Scene = lazy(() => import('./three/Scene').then((m) => ({ default: m.Scene })))

const DEBUG = new URLSearchParams(location.search).has('debug')

function newAnswer(): string {
  const answer = pickAnswer(ANSWER_POOL, readRecent())
  pushRecent(answer)
  return answer
}

export default function App() {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(newAnswer()))
  const [flyTo, setFlyTo] = useState<string | null>(null)
  const [homeToken, setHomeToken] = useState(0)
  const [debugColors, setDebugColors] = useState<BoneColors>({})
  const [modal, setModal] = useState<'help' | 'bones' | null>('help')
  // Bones with no mesh (coccyx and auditory ossicles are absent from BodyParts3D) cannot be guessed or answered.
  const index = useMemo(() => new SearchIndex(catalog.filter((b) => b.meshNames.length > 0)), [])

  useEffect(() => {
    loadGeometry().then(setGeometry, (e: Error) => setLoadError(e.message))
  }, [])

  const colors = useMemo<BoneColors>(() => {
    const c: BoneColors = { ...debugColors }
    for (const g of state.guesses) c[g.slug] = heatToColor(g.heat, g.slug === state.answer)
    return c
  }, [state.guesses, state.answer, debugColors])

  const guessed = useMemo(() => new Set(state.guesses.map((g) => g.slug)), [state.guesses])

  const onGuess = useCallback(
    (slug: string) => {
      if (!geometry || state.status !== 'playing' || guessed.has(slug)) return
      dispatch({ type: 'guess', slug, geometry })
      // Win: frame the answer.
      if (slug === state.answer) setFlyTo(slug)
    },
    [geometry, state.status, state.answer, guessed],
  )

  const playAgain = useCallback(() => {
    dispatch({ type: 'newGame', answer: newAnswer() })
    setFlyTo(null)
    setHomeToken((t) => t + 1)
  }, [])

  const debugState = (s: GameState) => (DEBUG ? ` · answer: ${s.answer}` : '')

  const closeModal = useCallback(() => setModal(null), [])

  return (
    <div className="app">
      <div className="scene">
        <Suspense fallback={null}>
          <Scene colors={colors} flyToSlug={flyTo} homeToken={homeToken} />
        </Suspense>
      </div>
      <Header
        onHelp={() => setModal('help')}
        onBones={() => setModal('bones')}
        onHome={() => setHomeToken((t) => t + 1)}
      />
      <aside className="panel">
        <GuessInput
          index={index}
          guessed={guessed}
          disabled={state.status === 'won' || !geometry}
          placeholder={
            state.status === 'won' ? 'You found it!' : geometry ? 'Guess a bone…' : 'Loading…'
          }
          onGuess={onGuess}
        />
        {loadError && <div className="guess-error">Failed to load geometry: {loadError}</div>}
        {!geometry && !loadError && <div className="muted">Loading skeleton…</div>}
        <div className="panel-label">
          <span>Guesses{debugState(state)}</span>
          <span className="count">{state.guesses.length}</span>
        </div>
        <GuessList guesses={state.guesses} answer={state.answer} onSelect={setFlyTo} />
      </aside>
      {state.status === 'won' && (
        <WinCard answer={state.answer} guessCount={state.guesses.length} onPlayAgain={playAgain} />
      )}
      {modal === 'help' && <HelpModal onClose={closeModal} />}
      {modal === 'bones' && <BoneListModal slugs={ANSWER_POOL} onClose={closeModal} />}
      {DEBUG && <DebugPanel colors={debugColors} onChange={setDebugColors} onFlyTo={setFlyTo} />}
    </div>
  )
}
