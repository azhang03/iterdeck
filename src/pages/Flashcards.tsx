import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Card, type SetWithCards } from '../api.ts'
import { PrimaryButton } from '../components/Button.tsx'
import { Empty, Status } from '../components/Cards.tsx'
import CodeStudyLayout, { type FocusSide } from '../components/CodeStudyLayout.tsx'
import OptionsPanel from '../components/OptionsPanel.tsx'
import ProblemPanel from '../components/ProblemPanel.tsx'
import ProgressBar from '../components/ProgressBar.tsx'
import SortControls from '../components/SortControls.tsx'
import StudyCard from '../components/StudyCard.tsx'
import StudyShell from '../components/StudyShell.tsx'
import { useAsync, useCodeDocs, useCodeSaver } from '../hooks.ts'
import * as fc from '../study/flashcards.ts'
import { DEFAULT_OPTIONS, deckFor, type StudyOptions } from '../study/options.ts'

export default function Flashcards() {
  const { id } = useParams()
  const setId = Number(id)
  const loaded = useAsync(() => api.sets.get(setId), [setId])
  const [options, setOptions] = useState<StudyOptions>(DEFAULT_OPTIONS)
  const [optionsOpen, setOptionsOpen] = useState(false)
  // Changing the deck or the front side starts a new session; the key remounts it.
  const [sessionKey, setSessionKey] = useState(0)
  const [focusSide, setFocusSide] = useState<FocusSide>('card')
  const docs = useCodeDocs(loaded.data)
  const saveCode = useCodeSaver()

  useEffect(() => {
    void api.sets.open(setId).catch(() => {})
  }, [setId])

  if (!loaded.data || loaded.data.id !== setId) return <Status error={loaded.error} loading={loaded.loading} />
  const set = loaded.data
  const deck = deckFor(set.cards, options)

  const actions = (
    <button type="button" onClick={() => setOptionsOpen(true)} className="rounded px-3 py-1 text-sm hover:bg-gray-100">
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
                <Link to={`/sets/${set.id}/edit`} className="text-blue-700 hover:underline">
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
          options={options}
          paused={optionsOpen}
          onOpenOptions={() => setOptionsOpen(true)}
          code={{ focusSide, setFocusSide, docs, saveCode }}
        />
      )}
      {optionsOpen && (
        <OptionsPanel
          options={options}
          onChange={setOptions}
          onRestart={() => {
            setSessionKey((k) => k + 1)
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
  options: StudyOptions
  paused: boolean
  onOpenOptions: () => void
  code: CodeState
}

function Session({ set, deck, options, paused, onOpenOptions, code }: SessionProps) {
  const [s, setS] = useState(() => fc.start(deck))
  const [error, setError] = useState<string | null>(null)
  const card = fc.current(s)
  const over = fc.roundOver(s)
  const codeMode = set.code_mode === 1

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
    record(s.index, card.id, checked)
    setS(fc.sort(s, checked))
  }

  function undo() {
    const { state, undone } = fc.undo(s)
    if (!undone) return
    record(state.index, undone.cardId, undone.checked, true)
    setS(state)
  }

  function restart() {
    failed.current.clear()
    setError(null)
    setS(fc.restart)
  }

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
        if (over) setS(fc.nextRound)
        else setS(fc.flip)
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
      <button type="button" onClick={() => setS(fc.shuffle)} disabled={over} className="rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50">
        Shuffle
      </button>
      <button type="button" onClick={onOpenOptions} className="rounded px-3 py-1 text-sm hover:bg-gray-100">
        Options
      </button>
    </>
  )

  const sum = fc.summary(s)

  const summary = (
    <div className={codeMode ? 'text-center' : 'rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm'}>
      <h2 className="mb-2 text-xl font-semibold">{fc.done(s) ? 'All cards checked' : `Round ${s.round} done`}</h2>
      <p className="mb-6 text-gray-600">
        {sum.checked} checked, {sum.missed} missed, {sum.percent}% right.
      </p>
      {fc.done(s) ? (
        <div className="flex justify-center gap-3">
          <PrimaryButton onClick={restart}>Restart</PrimaryButton>
          <Link to={`/sets/${set.id}`} className="rounded px-4 py-2 text-sm hover:bg-gray-100">
            Back to the set
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <PrimaryButton onClick={() => setS(fc.nextRound)}>Continue with the {sum.missed} missed</PrimaryButton>
          <span className="text-xs text-gray-500">or press Space</span>
        </div>
      )}
      <div className="mt-4">
        <button type="button" onClick={undo} className="rounded px-3 py-1 text-sm hover:bg-gray-100">
          Undo last card
        </button>
      </div>
    </div>
  )

  const controls = <SortControls onMiss={() => sort(false)} onCheck={() => sort(true)} onUndo={undo} canUndo={s.results.length > 0} />

  return (
    <StudyShell set={set} mode="Flashcards" round={s.round} actions={actions} wide={codeMode}>
      <ProgressBar done={s.index} total={s.queue.length} />
      {error && <p className="mb-4 text-sm text-red-600">Could not save a result: {error}</p>}

      {codeMode ? (
        <CodeStudyLayout
          set={set}
          card={over ? null : card}
          focusSide={code.focusSide}
          onFocusSide={code.setFocusSide}
          docs={code.docs}
          onCodeChange={code.saveCode}
          panelKey={over ? `over-${s.round}` : `${card?.id}-${s.flipped}`}
          panel={over ? summary : card && <ProblemPanel card={card} front={options.front} flipped={s.flipped} onFlip={() => setS(fc.flip)} />}
          footer={over ? undefined : controls}
        />
      ) : over ? (
        summary
      ) : (
        card && (
          <>
            <StudyCard card={card} front={options.front} flipped={s.flipped} onFlip={() => setS(fc.flip)} />
            {controls}
          </>
        )
      )}
    </StudyShell>
  )
}
