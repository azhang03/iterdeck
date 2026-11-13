import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Card, type SetWithCards } from '../api.ts'
import { PrimaryButton } from '../components/Button.tsx'
import { Empty, Status } from '../components/Cards.tsx'
import Clock from '../components/Clock.tsx'
import CodeStudyLayout, { type FocusSide } from '../components/CodeStudyLayout.tsx'
import OptionsPanel from '../components/OptionsPanel.tsx'
import ProblemPanel from '../components/ProblemPanel.tsx'
import ProgressBar from '../components/ProgressBar.tsx'
import Scorecard, { type ScoreRow } from '../components/Scorecard.tsx'
import SortControls from '../components/SortControls.tsx'
import CardNote from '../components/CardNote.tsx'
import StudyCard from '../components/StudyCard.tsx'
import StudyShell from '../components/StudyShell.tsx'
import { useCardTime, useSessionClock, useStudyMotion, useStudyPage, type CardNotes, type ProgressSaver } from '../hooks.ts'
import { formatClock } from '../study/clock.ts'
import * as learn from '../study/learn.ts'
import { deckFor, sideText, type StudyOptions } from '../study/options.ts'
import { cardLabel, savedTallies, testsPassed, timeByCard, timeOf, type TestTally } from '../study/scorecard.ts'

export default function Learn() {
  const { id } = useParams()
  const setId = Number(id)
  const page = useStudyPage(setId, 'learn', learn.resume)
  const { loaded, options, setOptions, sessionKey, initial, initialElapsedMs, initialSaved, docs, codeSaver, notes, progress, restart } = page
  const [optionsOpen, setOptionsOpen] = useState(false)
  // Code mode state lives here so an options change keeps the code and the active side.
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
                <Link to={`/sets/${set.id}/edit`} className="text-accent hover:underline">
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
          initial={initial}
          initialElapsedMs={initialElapsedMs}
          initialSaved={initialSaved}
          options={options}
          paused={optionsOpen}
          progress={progress}
          onOpenOptions={() => setOptionsOpen(true)}
          onRestart={restart}
          code={{ focusSide, setFocusSide, docs, saveCode: codeSaver.save }}
          notes={notes}
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
          showGroupSize
        />
      )}
    </>
  )
}

type CodeState = {
  focusSide: FocusSide
  setFocusSide: (side: FocusSide) => void
  docs: Map<number, string>
  saveCode: (cardId: number, code: string) => void
}

type SessionProps = {
  set: SetWithCards
  deck: Card[]
  initial: learn.LearnState | null
  initialElapsedMs: number
  initialSaved: unknown
  options: StudyOptions
  paused: boolean
  progress: ProgressSaver
  notes: CardNotes
  onOpenOptions: () => void
  onRestart: () => void
  code: CodeState
}

function Session({ set, deck, initial, initialElapsedMs, initialSaved, options, paused, progress, notes, onOpenOptions, onRestart, code }: SessionProps) {
  const [s, setS] = useState(() => initial ?? learn.start(deck, options.groupSize))
  const card = learn.current(s)
  const codeMode = set.code_mode === 1
  const { target: motionTarget, play } = useStudyMotion(codeMode)
  // Names the card on screen and its place in the group; null at a debrief and at the end.
  const cardKey = s.phase === 'round' && card ? `${s.groupIndex}-${s.index}-${card.id}` : null
  const cardTime = useCardTime(cardKey)
  // The last test run of each card, for the scorecard. Saved with the session; a new session starts with none.
  const [tallies, setTallies] = useState(() => savedTallies(initialSaved))

  function sort(checked: boolean) {
    if (s.phase !== 'round' || !card) return
    play({ kind: 'next', checked })
    setS(learn.sort(s, checked, cardTime()))
  }

  function undo() {
    const last = s.results.at(-1)
    if (!last || s.phase === 'done') return
    play({ kind: 'undo', checked: last.checked })
    setS(learn.undo)
  }

  function flip() {
    if (s.phase !== 'round') return
    play({ kind: 'flip' })
    setS(learn.flip)
  }

  // Another card comes on screen with no sort: a shuffle, or the next group.
  function swap(change: (state: learn.LearnState) => learn.LearnState) {
    play({ kind: 'swap' })
    setS(change)
  }

  // The start of the current group is saved; progress inside the group is not.
  // Dropped when every group is done.
  const snapshot = useMemo(() => (s.phase === 'done' ? null : { ...learn.snapshot(s, options), tallies }), [s, options, tallies])
  const session = useSessionClock(progress, snapshot, initialElapsedMs)

  // The card clock starts again for each card. No card is on screen at a debrief.
  const clocks = (
    <>
      {cardKey && <Clock key={cardKey} label="Card" />}
      <Clock label="Session" read={session.read} running={session.running} />
    </>
  )

  useEffect(() => {
    // In code mode, keys act only when the card side was used last.
    if (paused || (codeMode && code.focusSide !== 'card')) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      // A key typed in a text field (the note of the card) is text, not a study key.
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key === ' ') {
        const t = e.target
        if (t instanceof HTMLButtonElement || t instanceof HTMLAnchorElement) return
        e.preventDefault()
        if (s.phase === 'debrief') swap(learn.proceed)
        else flip()
      } else if (s.phase === 'round' && (e.key === '1' || e.key === '2')) {
        e.preventDefault()
        sort(e.key === '2')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const actions = (
    <>
      <button
        type="button"
        onClick={() => swap(learn.shuffle)}
        disabled={!learn.canShuffle(s)}
        title="Shuffle the cards still to come"
        className="rounded px-3 py-1 text-sm hover:bg-hover disabled:opacity-50"
      >
        Shuffle
      </button>
      <button type="button" onClick={onOpenOptions} className="rounded px-3 py-1 text-sm hover:bg-hover">
        Options
      </button>
    </>
  )

  const groups = learn.segments(s)
  const round = s.phase === 'done' ? undefined : s.passes.length

  const finished = (
    <div className={codeMode ? 'text-center' : 'rounded-card border border-line bg-surface p-8 text-center shadow-card motion-safe:animate-pop-in'}>
      <h2 className="mb-2 text-xl font-semibold">All groups done</h2>
      <p className="mb-6 text-muted">Every card was checked.</p>
      <div className="flex justify-center gap-3">
        <PrimaryButton onClick={onRestart}>Restart</PrimaryButton>
        <Link to={`/sets/${set.id}`} className="rounded px-4 py-2 text-sm hover:bg-hover">
          Back to the set
        </Link>
      </div>
    </div>
  )

  const debrief = <Debrief s={s} options={options} codeMode={codeMode} tallies={tallies} onContinue={() => swap(learn.proceed)} onUndo={undo} />

  const controls = (
    <SortControls
      onMiss={() => sort(false)}
      onCheck={() => sort(true)}
      onUndo={undo}
      canUndo={s.results.length > 0}
    />
  )

  // The note of the card on screen. The key gives each card its own editor.
  const note = card && <CardNote key={card.id} note={notes.edited[card.id] ?? card.note} onSave={(text, keepalive) => notes.save(card.id, text, keepalive)} />

  const solo = learn.isSolo(s) && <p className="mb-3 text-center text-sm text-muted">One more try for this card.</p>

  return (
    <StudyShell
      set={set}
      mode={s.phase === 'done' ? 'Learn' : `Learn · Group ${s.groupIndex + 1} of ${groups.length}`}
      round={round}
      clocks={clocks}
      actions={actions}
      wide={codeMode}
    >
      <ProgressBar done={learn.cleared(s).length} total={s.group.length} segments={groups} />

      {codeMode ? (
        <CodeStudyLayout
          set={set}
          card={s.phase === 'round' ? card : null}
          focusSide={code.focusSide}
          onFocusSide={code.setFocusSide}
          docs={code.docs}
          onCodeChange={code.saveCode}
          panelKey={`${s.phase}-${s.groupIndex}-${s.index}-${card?.id}-${s.flipped}`}
          panel={
            s.phase === 'done' ? (
              finished
            ) : s.phase === 'debrief' ? (
              debrief
            ) : (
              card && (
                <>
                  {solo}
                  <ProblemPanel card={card} front={options.front} flipped={s.flipped} onFlip={flip} />
                </>
              )
            )
          }
          footer={
            s.phase === 'round' ? (
              <>
                <div className="mb-3">{note}</div>
                {controls}
              </>
            ) : undefined
          }
          panelRef={motionTarget}
          onTested={(cardId, tally) => setTallies((t) => ({ ...t, [cardId]: tally }))}
        />
      ) : (
        <>
          {s.phase === 'done' && finished}
          {s.phase === 'debrief' && debrief}
          {s.phase === 'round' && card && (
            <>
              {solo}
              <StudyCard ref={motionTarget} card={card} front={options.front} flipped={s.flipped} onFlip={flip} />
              <div className="mt-4">{note}</div>
              {controls}
            </>
          )}
        </>
      )}
    </StudyShell>
  )
}

type DebriefProps = {
  s: learn.LearnState
  options: StudyOptions
  codeMode: boolean
  tallies: Record<number, TestTally>
  onContinue: () => void
  onUndo: () => void
}

// Shown when a group is done or a card is carried: the scorecard of the group.
// Each card has one row, with its misses and the time over every pass.
function Debrief({ s, options, codeMode, tallies, onContinue, onUndo }: DebriefProps) {
  const group = learn.groupSummary(s)
  const firstTry = group.filter((r) => r.misses === 0).length
  const times = timeByCard(s.results)
  const next = s.carry
    ? `"${cardLabel(sideText(s.carry, options.front).text)}" missed its second chance. It moves to the end of the next group.`
    : s.remaining.length === 0
      ? 'That was the last group.'
      : 'Continue to the next group.'

  const rows: ScoreRow[] = group.map(({ card, misses }) => ({
    key: card.id,
    label: cardLabel(sideText(card, options.front).text),
    result:
      misses === 0 ? <span className="text-ok">{'\u2713'} First try</span> : <span className="text-miss">{'\u2715'} Missed {misses === 1 ? 'once' : `${misses} times`}</span>,
    ms: times.get(card.id) ?? null,
    tests: tallies[card.id] ?? null,
  }))
  const time = timeOf(rows)
  const tests = testsPassed(rows.map((r) => r.tests))
  const stats = [
    { value: `${firstTry} of ${rows.length}`, label: 'on the first try' },
    { value: String(s.passes.length), label: s.passes.length === 1 ? 'pass' : 'passes' },
    { value: time.count ? formatClock(time.total) : 'none', label: 'time on cards' },
    ...(codeMode ? [{ value: tests.ran ? `${tests.passed} of ${tests.ran}` : 'none', label: 'cards run with all tests passed' }] : []),
  ]

  return (
    <div className={codeMode ? 'text-center' : 'rounded-card border border-line bg-surface p-8 text-center shadow-card motion-safe:animate-pop-in'}>
      <h2 className="text-xl font-semibold">Group {s.groupIndex + 1} scorecard</h2>
      <Scorecard stats={stats} rows={rows} showTests={codeMode} />
      <p className="mb-4 text-muted">{next}</p>
      <div className="flex flex-col items-center gap-2">
        <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
        <span className="text-xs text-muted">or press Space</span>
        <button type="button" onClick={onUndo} className="mt-2 rounded px-3 py-1 text-sm hover:bg-hover">
          Undo last card
        </button>
      </div>
    </div>
  )
}
