import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Card, type SetWithCards } from '../api.ts'
import { PrimaryButton } from '../components/Button.tsx'
import { Empty, Status } from '../components/Cards.tsx'
import OptionsPanel from '../components/OptionsPanel.tsx'
import ProgressBar from '../components/ProgressBar.tsx'
import StudyCard from '../components/StudyCard.tsx'
import StudyShell from '../components/StudyShell.tsx'
import { useAsync } from '../hooks.ts'
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

type SessionProps = { set: SetWithCards; deck: Card[]; options: StudyOptions; paused: boolean; onOpenOptions: () => void }

function Session({ set, deck, options, paused, onOpenOptions }: SessionProps) {
  const [s, setS] = useState(() => fc.start(deck))
  const [error, setError] = useState<string | null>(null)
  const card = fc.current(s)
  const over = fc.roundOver(s)

  function record(cardId: number, checked: boolean, undo = false) {
    api.cards.sort(cardId, checked, undo).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }

  function sort(checked: boolean) {
    if (!card) return
    record(card.id, checked)
    setS(fc.sort(s, checked))
  }

  function undo() {
    const { state, undone } = fc.undo(s)
    if (!undone) return
    record(undone.cardId, undone.checked, true)
    setS(state)
  }

  useEffect(() => {
    if (paused) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === ' ') {
        e.preventDefault()
        if (over) setS(fc.nextRound)
        else setS(fc.flip)
      } else if (e.key === '1') sort(false)
      else if (e.key === '2') sort(true)
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

  return (
    <StudyShell set={set} mode="Flashcards" round={s.round} actions={actions}>
      <ProgressBar done={s.index} total={s.queue.length} />
      {error && <p className="mb-4 text-sm text-red-600">Could not save a result: {error}</p>}

      {over ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="mb-2 text-xl font-semibold">{fc.done(s) ? 'All cards checked' : `Round ${s.round} done`}</h2>
          <p className="mb-6 text-gray-600">
            {sum.checked} checked, {sum.missed} missed, {sum.percent}% right.
          </p>
          {fc.done(s) ? (
            <div className="flex justify-center gap-3">
              <PrimaryButton onClick={() => setS(fc.restart)}>Restart</PrimaryButton>
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
      ) : (
        card && (
          <>
            <StudyCard card={card} front={options.front} flipped={s.flipped} onFlip={() => setS(fc.flip)} />
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => sort(false)}
                aria-label="Mark as missed (1)"
                className="h-14 w-14 rounded-full border-2 border-red-400 text-2xl text-red-600 hover:bg-red-50"
              >
                {'\u2715'}
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={s.results.length === 0}
                aria-label="Undo last card"
                className="rounded px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-40"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => sort(true)}
                aria-label="Mark as checked (2)"
                className="h-14 w-14 rounded-full border-2 border-green-500 text-2xl text-green-700 hover:bg-green-50"
              >
                {'\u2713'}
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-gray-500">Space flips, 1 marks missed, 2 marks checked.</p>
          </>
        )
      )}
    </StudyShell>
  )
}
