import { useEffect, useRef, useState, type RefObject } from 'react'
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
import { useAsync } from '../hooks.ts'
import * as learn from '../study/learn.ts'
import { DEFAULT_OPTIONS, deckFor, sideText, type StudyOptions } from '../study/options.ts'

export default function Learn() {
  const { id } = useParams()
  const setId = Number(id)
  const loaded = useAsync(() => api.sets.get(setId), [setId])
  const [options, setOptions] = useState<StudyOptions>(DEFAULT_OPTIONS)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)
  // Code mode state lives here so an options change keeps the code and the active side.
  const [focusSide, setFocusSide] = useState<FocusSide>('card')
  const doc = useRef('')

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
        <StudyShell set={set} mode="Learn" actions={actions}>
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
          key={`${sessionKey}-${options.front}-${options.starredOnly}-${options.groupSize}`}
          set={set}
          deck={deck}
          options={options}
          paused={optionsOpen}
          onOpenOptions={() => setOptionsOpen(true)}
          code={{ focusSide, setFocusSide, doc }}
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
          showGroupSize
        />
      )}
    </>
  )
}

type CodeState = { focusSide: FocusSide; setFocusSide: (side: FocusSide) => void; doc: RefObject<string> }

type SessionProps = {
  set: SetWithCards
  deck: Card[]
  options: StudyOptions
  paused: boolean
  onOpenOptions: () => void
  code: CodeState
}

function Session({ set, deck, options, paused, onOpenOptions, code }: SessionProps) {
  const [s, setS] = useState(() => learn.start(deck, options.groupSize))
  const card = learn.current(s)
  const codeMode = set.code_mode === 1

  useEffect(() => {
    // In code mode, keys act only when the card side was used last.
    if (paused || (codeMode && code.focusSide !== 'card')) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      if (e.key === ' ') {
        const t = e.target
        if (t instanceof HTMLButtonElement || t instanceof HTMLAnchorElement) return
        e.preventDefault()
        if (s.phase === 'debrief') setS(learn.proceed)
        else if (s.phase === 'round') setS(learn.flip)
      } else if (s.phase === 'round' && (e.key === '1' || e.key === '2')) {
        e.preventDefault()
        setS(learn.sort(s, e.key === '2'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const actions = (
    <>
      <button
        type="button"
        onClick={() => setS(learn.shuffle)}
        disabled={!learn.canShuffle(s)}
        title="Shuffle the cards still to come"
        className="rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
      >
        Shuffle
      </button>
      <button type="button" onClick={onOpenOptions} className="rounded px-3 py-1 text-sm hover:bg-gray-100">
        Options
      </button>
    </>
  )

  const groups = learn.segments(s)
  const round = s.phase === 'done' ? undefined : s.passes.length

  const finished = (
    <div className={codeMode ? 'text-center' : 'rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm'}>
      <h2 className="mb-2 text-xl font-semibold">All groups done</h2>
      <p className="mb-6 text-gray-600">Every card was checked.</p>
      <div className="flex justify-center gap-3">
        <PrimaryButton onClick={() => setS(learn.restart)}>Restart</PrimaryButton>
        <Link to={`/sets/${set.id}`} className="rounded px-4 py-2 text-sm hover:bg-gray-100">
          Back to the set
        </Link>
      </div>
    </div>
  )

  const debrief = <Debrief s={s} options={options} plain={codeMode} onContinue={() => setS(learn.proceed)} onUndo={() => setS(learn.undo)} />

  const controls = (
    <SortControls
      onMiss={() => setS(learn.sort(s, false))}
      onCheck={() => setS(learn.sort(s, true))}
      onUndo={() => setS(learn.undo)}
      canUndo={s.results.length > 0}
    />
  )

  const solo = learn.isSolo(s) && <p className="mb-3 text-center text-sm text-gray-500">One more try for this card.</p>

  return (
    <StudyShell
      set={set}
      mode={s.phase === 'done' ? 'Learn' : `Learn · Group ${s.groupIndex + 1} of ${groups.length}`}
      round={round}
      actions={actions}
      wide={codeMode}
    >
      <ProgressBar done={learn.cleared(s).length} total={s.group.length} segments={groups} />

      {codeMode ? (
        <CodeStudyLayout
          setId={set.id}
          focusSide={code.focusSide}
          onFocusSide={code.setFocusSide}
          doc={code.doc}
          panelKey={`${s.phase}-${s.groupIndex}-${s.index}-${s.flipped}`}
          panel={
            s.phase === 'done' ? (
              finished
            ) : s.phase === 'debrief' ? (
              debrief
            ) : (
              card && (
                <>
                  {solo}
                  <ProblemPanel card={card} front={options.front} flipped={s.flipped} onFlip={() => setS(learn.flip)} />
                </>
              )
            )
          }
          footer={s.phase === 'round' ? controls : undefined}
        />
      ) : (
        <>
          {s.phase === 'done' && finished}
          {s.phase === 'debrief' && debrief}
          {s.phase === 'round' && card && (
            <>
              {solo}
              <StudyCard card={card} front={options.front} flipped={s.flipped} onFlip={() => setS(learn.flip)} />
              {controls}
            </>
          )}
        </>
      )}
    </StudyShell>
  )
}

type DebriefProps = { s: learn.LearnState; options: StudyOptions; plain?: boolean; onContinue: () => void; onUndo: () => void }

// Shown when a group is done or a card is carried: every card of the group with its misses.
function Debrief({ s, options, plain = false, onContinue, onUndo }: DebriefProps) {
  const rows = learn.groupSummary(s)
  const firstTry = rows.filter((r) => r.misses === 0).length
  const next = s.carry
    ? `"${sideText(s.carry, options.front).text || '(empty)'}" missed its second chance. It moves to the end of the next group.`
    : s.remaining.length === 0
      ? 'That was the last group.'
      : 'Continue to the next group.'

  return (
    <div className={plain ? '' : 'rounded-xl border border-gray-200 bg-white p-8 shadow-sm'}>
      <h2 className="mb-1 text-center text-xl font-semibold">Group {s.groupIndex + 1} done</h2>
      <p className="mb-6 text-center text-gray-600">
        {firstTry} of {rows.length} on the first try, {s.passes.length} {s.passes.length === 1 ? 'pass' : 'passes'}. {next}
      </p>
      <ul className="mb-6 space-y-1">
        {rows.map(({ card, misses }) => (
          <li key={card.id} className="flex items-center gap-3 text-sm">
            <span className={misses === 0 ? 'text-green-700' : 'text-red-600'}>{misses === 0 ? '\u2713' : '\u2715'}</span>
            <span className="truncate">{sideText(card, options.front).text || '(empty)'}</span>
            {misses > 0 && <span className="text-xs text-gray-500">missed {misses === 1 ? 'once' : `${misses} times`}</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-center gap-2">
        <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
        <span className="text-xs text-gray-500">or press Space</span>
        <button type="button" onClick={onUndo} className="mt-2 rounded px-3 py-1 text-sm hover:bg-gray-100">
          Undo last card
        </button>
      </div>
    </div>
  )
}
