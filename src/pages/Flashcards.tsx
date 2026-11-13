import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Card, type SetWithCards } from '../api.ts'
import { PrimaryButton } from '../components/Button.tsx'
import { Empty, Status } from '../components/Cards.tsx'
import Clock from '../components/Clock.tsx'
import CodeStudyLayout, { type FocusSide } from '../components/CodeStudyLayout.tsx'
import OptionsPanel from '../components/OptionsPanel.tsx'
import ProblemPanel from '../components/ProblemPanel.tsx'
import ProgressBar from '../components/ProgressBar.tsx'
import SortControls from '../components/SortControls.tsx'
import StudyCard from '../components/StudyCard.tsx'
import StudyShell from '../components/StudyShell.tsx'
import { useSessionClock, useStudyMotion, useStudyPage, type ProgressSaver } from '../hooks.ts'
import * as fc from '../study/flashcards.ts'
import { deckFor, type StudyOptions } from '../study/options.ts'

export default function Flashcards() {
  const { id } = useParams()
  const setId = Number(id)
  const page = useStudyPage(setId, 'flashcards', fc.resume)
  const { loaded, options, setOptions, sessionKey, initial, initialElapsedMs, docs, codeSaver, progress, restart } = page
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [focusSide, setFocusSide] = useState<FocusSide>('card')

  useEffect(() => {
    void api.sets.open(setId).catch(() => {})
  }, [setId])

  if (!loaded.data || loaded.data.id !== setId) return <Status error={loaded.error} loading={loaded.loading} />
  const set = loaded.data
  const deck = deckFor(set.cards, options)

  const actions = (
    <button type="button" onClick={() => setOptionsOpen(true)} className="rounded px-3 py-1 text-sm hover:bg-hover">
      Options
    </button>
  )

  return (
    <>
      {deck.length === 0 ? (
        <StudyShell set={set} mode="Flashcards" actions={actions}>
          <Empty>
            {options.starredOnly ? (
              <>
                No starred cards in this set.{' '}
                <PrimaryButton onClick={() => setOptions({ ...options, starredOnly: false })}>Study all cards</PrimaryButton>
              </>
            ) : (
              <>
                This set has no cards.{' '}
                <Link to={`/sets/${set.id}/edit`} className="text-accent hover:underline">
                  Open the editor
                </Link>
              </>
            )}
          </Empty>
        </StudyShell>
      ) : (
        <Session
          key={`${sessionKey}-${options.front}-${options.starredOnly}`}
          set={set}
          deck={deck}
          initial={initial}
          initialElapsedMs={initialElapsedMs}
          options={options}
          paused={optionsOpen}
          progress={progress}
          onOpenOptions={() => setOptionsOpen(true)}
          onRestart={restart}
          code={{ focusSide, setFocusSide, docs, saveCode: codeSaver.save }}
        />
      )}
      {optionsOpen && (
        <OptionsPanel
          options={options}
          onChange={setOptions}
          onRestart={() => {
            restart()
            setOptionsOpen(false)
          }}
          onClose={() => setOptionsOpen(false)}
        />
      )}
    </>
  )
}

// Code mode state owned by the page, so an options change (which restarts the
// session) keeps the code and the active side.
type CodeState = {
  focusSide: FocusSide
  setFocusSide: (side: FocusSide) => void
  docs: Map<number, string>
  saveCode: (cardId: number, code: string) => void
}

type SessionProps = {
  set: SetWithCards
  deck: Card[]
  initial: fc.FlashcardsState | null
  initialElapsedMs: number
  options: StudyOptions
  paused: boolean
  progress: ProgressSaver
  onOpenOptions: () => void
  onRestart: () => void
  code: CodeState
}

function Session({ set, deck, initial, initialElapsedMs, options, paused, progress, onOpenOptions, onRestart, code }: SessionProps) {
  const [s, setS] = useState(() => initial ?? fc.start(deck))
  const [error, setError] = useState<string | null>(null)
  const card = fc.current(s)
  const over = fc.roundOver(s)
  const codeMode = set.code_mode === 1
  const { target: motionTarget, play } = useStudyMotion(codeMode)

  // Stats calls go out one after another, so a sort and its undo cannot arrive out of
  // order. A sort that failed is remembered; its undo is not sent.
  const chain = useRef(Promise.resolve())
  const failed = useRef(new Set<number>())

  function record(index: number, cardId: number, checked: boolean, undo = false) {
    chain.current = chain.current.then(async () => {
      if (undo && failed.current.delete(index)) return
      try {
        await api.cards.sort(cardId, checked, undo)
        setError(null)
      } catch (err) {
        if (!undo) failed.current.add(index)
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  function sort(checked: boolean) {
    if (!card) return
    play({ kind: 'next', checked })
    record(s.index, card.id, checked)
    setS(fc.sort(s, checked))
  }

  function undo() {
    const { state, undone } = fc.undo(s)
    if (!undone) return
    play({ kind: 'undo', checked: undone.checked })
    record(state.index, undone.cardId, undone.checked, true)
    setS(state)
  }

  function flip() {
    if (over) return
    play({ kind: 'flip' })
    setS(fc.flip)
  }

  // Another card comes on screen with no sort: a shuffle, or the next round.
  function swap(change: (state: fc.FlashcardsState) => fc.FlashcardsState) {
    play({ kind: 'swap' })
    setS(change)
  }

  // The position is saved after every change, and dropped when every card is checked.
  const snapshot = useMemo(() => (fc.done(s) ? null : fc.snapshot(s, options)), [s, options])
  const session = useSessionClock(progress, snapshot, initialElapsedMs)

  // The card clock starts again for each card. No card is on screen at a round summary.
  const clocks = (
    <>
      {!over && card && <Clock key={`${s.round}-${s.index}-${card.id}`} label="Card" />}
      <Clock label="Session" read={session.read} running={session.running} />
    </>
  )

  useEffect(() => {
    // In code mode, keys act only when the card side was used last.
    if (paused || (codeMode && code.focusSide !== 'card')) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      if (e.key === ' ') {
        // Space on a focused button or link presses it; the card button flips through its own click.
        const t = e.target
        if (t instanceof HTMLButtonElement || t instanceof HTMLAnchorElement) return
        e.preventDefault()
        // Nothing follows the last summary.
        if (!over) flip()
        else if (!fc.done(s)) swap(fc.nextRound)
      } else if (e.key === '1' || e.key === '2') {
        // Also stops the digit from reaching the editor when it still has DOM focus.
        e.preventDefault()
        sort(e.key === '2')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const actions = (
    <>
      <button type="button" onClick={() => swap(fc.shuffle)} disabled={over} className="rounded px-3 py-1 text-sm hover:bg-hover disabled:opacity-50">
        Shuffle
      </button>
      <button type="button" onClick={onOpenOptions} className="rounded px-3 py-1 text-sm hover:bg-hover">
        Options
      </button>
    </>
  )

  const sum = fc.summary(s)

  const summary = (
    <div className={codeMode ? 'text-center' : 'rounded-card border border-line bg-surface p-8 text-center shadow-card motion-safe:animate-pop-in'}>
      <h2 className="mb-2 text-xl font-semibold">{fc.done(s) ? 'All cards checked' : `Round ${s.round} done`}</h2>
      <p className="mb-6 text-muted">
        {sum.checked} checked, {sum.missed} missed, {sum.percent}% right.
      </p>
      {fc.done(s) ? (
        <div className="flex justify-center gap-3">
          <PrimaryButton onClick={onRestart}>Restart</PrimaryButton>
          <Link to={`/sets/${set.id}`} className="rounded px-4 py-2 text-sm hover:bg-hover">
            Back to the set
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <PrimaryButton onClick={() => swap(fc.nextRound)}>Continue with the {sum.missed} missed</PrimaryButton>
          <span className="text-xs text-muted">or press Space</span>
        </div>
      )}
      <div className="mt-4">
        <button type="button" onClick={undo} className="rounded px-3 py-1 text-sm hover:bg-hover">
          Undo last card
        </button>
      </div>
    </div>
  )

  const controls = <SortControls onMiss={() => sort(false)} onCheck={() => sort(true)} onUndo={undo} canUndo={s.results.length > 0} />

  return (
    <StudyShell set={set} mode="Flashcards" round={s.round} clocks={clocks} actions={actions} wide={codeMode}>
      <ProgressBar done={s.index} total={s.queue.length} />
      {error && <p className="mb-4 text-sm text-bad">Could not save a result: {error}</p>}

      {codeMode ? (
        <CodeStudyLayout
          set={set}
          card={over ? null : card}
          focusSide={code.focusSide}
          onFocusSide={code.setFocusSide}
          docs={code.docs}
          onCodeChange={code.saveCode}
          panelKey={over ? `over-${s.round}` : `${card?.id}-${s.flipped}`}
          panel={over ? summary : card && <ProblemPanel card={card} front={options.front} flipped={s.flipped} onFlip={flip} />}
          footer={over ? undefined : controls}
          panelRef={motionTarget}
        />
      ) : over ? (
        summary
      ) : (
        card && (
          <>
            <StudyCard ref={motionTarget} card={card} front={options.front} flipped={s.flipped} onFlip={flip} />
            {controls}
          </>
        )
      )}
    </StudyShell>
  )
}
