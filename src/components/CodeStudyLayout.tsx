import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Card, SetWithCards } from '../api.ts'
import {
  createRunner,
  type CheckResult,
  type PrepareStatus,
  type RunError,
  type RunResult,
  type Runner,
  type TestResult,
} from '../run/runner.ts'
import { SqlRunner, type Table } from '../run/sql.ts'
import { LANGUAGES } from '../study/languages.ts'
import CodeEditor from './CodeEditor.tsx'
import OutputPanel, { type OutputTab } from './OutputPanel.tsx'

export type FocusSide = 'card' | 'editor'

type Props = {
  set: SetWithCards
  card: Card | null // the card on screen; null while a summary or debrief shows
  focusSide: FocusSide
  onFocusSide: (side: FocusSide) => void
  docs: Map<number, string>
  onCodeChange: (cardId: number, text: string) => void
  panelKey: string // changes with the panel content, so the scroll position resets
  panel: ReactNode // the description panel content (the card, a summary, or a debrief)
  footer?: ReactNode // sort buttons, in a bar at the bottom of the panel
}

type Loaded = { tables: Table[]; textFallback: string[]; failed: { name: string; message: string }[] }

const toolButton = 'rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50'

// Code mode: the card as a problem description on the left, a code editor with
// a run toolbar and an output panel on the right. The side used last (by mouse
// or keyboard focus) gets the keys; an outline marks it.
export default function CodeStudyLayout({ set, card, focusSide, onFocusSide, docs, onCodeChange, panelKey, panel, footer }: Props) {
  const [clearToken, setClearToken] = useState(0)
  const runner = useRef<Runner | null>(null)
  const [status, setStatus] = useState<PrepareStatus>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [busy, setBusy] = useState(false)
  const [output, setOutput] = useState<RunResult | null>(null)
  const [verdict, setVerdict] = useState<CheckResult | TestResult[] | null>(null)
  const [tab, setTab] = useState<OutputTab>('output')
  const [diagnostics, setDiagnostics] = useState<RunError | null>(null)
  // The editor keeps showing the last card while a summary is on screen.
  const [lastCard, setLastCard] = useState<Card | null>(card)
  if (card && card !== lastCard) setLastCard(card)
  const activeCard = card ?? lastCard

  // One runner per set. Created and loaded in a microtask, so a cleanup that
  // runs first (StrictMode) leaves nothing behind.
  useEffect(() => {
    const language = set.language
    if (!language) return
    let live = true
    let r: Runner | null = null
    void Promise.resolve()
      .then(() => {
        if (!live) return
        setStatus('loading')
        setLoadError(null)
        setLoaded(null)
        r = createRunner(language)
        return r.prepare(set)
      })
      .then(
        () => {
          if (!live || !r) return
          runner.current = r
          setStatus('ready')
          setLoaded(r instanceof SqlRunner ? { tables: r.tables, textFallback: r.textFallback, failed: r.failed } : { tables: [], textFallback: [], failed: [] })
        },
        (err: unknown) => {
          if (!live) return
          setStatus('failed')
          setLoadError(err instanceof Error ? err.message : String(err))
        },
      )
    return () => {
      live = false
      r?.dispose()
      runner.current = null
    }
  }, [set])

  const ready = status === 'ready' && !busy

  function codeOf(cardId: number | null): string {
    return cardId === null ? '' : (docs.get(cardId) ?? '')
  }

  // The card the editor showed when a run started; a run that ends after a card
  // switch must not mark the new card's text.
  const activeId = useRef<number | null>(null)
  useEffect(() => {
    activeId.current = activeCard?.id ?? null
  })

  async function run() {
    const r = runner.current
    if (!r || !ready) return
    const cardId = activeCard?.id ?? null
    setBusy(true)
    try {
      const result = await r.run(codeOf(cardId))
      setOutput(result)
      if (activeId.current === cardId) setDiagnostics(result.ok ? null : result.error)
      setTab('output')
    } finally {
      setBusy(false)
    }
  }

  // Check and Run tests belong to one card. A verdict that arrives after the
  // user moved to another card is dropped.
  async function check() {
    const r = runner.current
    if (!r || !ready || !card || set.language !== 'postgresql') return
    setBusy(true)
    try {
      const result = await r.check(codeOf(card.id), card)
      if (activeId.current !== card.id) return
      setVerdict(result)
      setTab('result')
    } finally {
      setBusy(false)
    }
  }

  // A card with no tests gives an empty list; the Result tab explains it.
  async function test() {
    const r = runner.current
    if (!r || !ready || !card || set.language !== 'python') return
    setBusy(true)
    try {
      const result = card.tests.trim() === '' ? [] : await r.test(codeOf(card.id), card)
      if (activeId.current !== card.id) return
      setVerdict(result)
      setTab('result')
    } finally {
      setBusy(false)
    }
  }

  // Cmd+Enter and Cmd+Shift+Enter from the card side. The editor handles its
  // own and marks the event as handled.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      if (e.shiftKey) void test()
      else void run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function codeChanged(cardId: number, text: string) {
    onCodeChange(cardId, text)
    setDiagnostics((d) => (d ? null : d))
  }

  const outline = (side: FocusSide) =>
    `flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${focusSide === side ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`

  const languageLabel = LANGUAGES.find((l) => l.value === set.language)?.label
  const statusText = busy
    ? 'Running'
    : status === 'loading'
      ? `Loading ${languageLabel}`
      : status === 'ready'
        ? 'Ready'
        : status === 'failed'
          ? (loadError ?? 'Failed to load')
          : ''

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
      <section
        aria-label="Description"
        onMouseDownCapture={() => onFocusSide('card')}
        onFocusCapture={() => onFocusSide('card')}
        className={outline('card')}
      >
        <div key={panelKey} className="min-h-0 flex-1 overflow-y-auto p-6">
          {set.language === 'postgresql' && loaded && <TablesSection {...loaded} />}
          {panel}
        </div>
        {footer && <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">{footer}</div>}
      </section>
      <section
        aria-label="Code editor"
        onMouseDownCapture={() => onFocusSide('editor')}
        onFocusCapture={() => onFocusSide('editor')}
        className={outline('editor')}
      >
        {set.language === null ? (
          <div className="p-6 text-sm text-gray-600">
            Pick a language in the{' '}
            <Link to={`/sets/${set.id}/edit`} className="text-blue-700 hover:underline">
              editor
            </Link>{' '}
            to run code here.
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2">
              <span className="mr-2 text-sm font-medium">{languageLabel}</span>
              <button type="button" onClick={() => void run()} disabled={!ready} title="Cmd+Enter" className={toolButton}>
                Run
              </button>
              {set.language === 'postgresql' && (
                <button type="button" onClick={() => void check()} disabled={!ready || !card} className={toolButton}>
                  Check
                </button>
              )}
              {set.language === 'python' && (
                <button type="button" onClick={() => void test()} disabled={!ready || !card} title="Cmd+Shift+Enter" className={toolButton}>
                  Run tests
                </button>
              )}
              <button type="button" onClick={() => setClearToken((t) => t + 1)} className={toolButton}>
                Clear
              </button>
              <span className={`ml-auto text-xs ${status === 'failed' ? 'text-red-600' : 'text-gray-500'}`} role="status">
                {statusText}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor
                language={set.language}
                cardId={activeCard?.id ?? null}
                docs={docs}
                onChange={codeChanged}
                onRun={() => void run()}
                onTest={() => void test()}
                clearToken={clearToken}
                diagnostics={diagnostics}
              />
            </div>
            <OutputPanel setId={set.id} language={set.language} tab={tab} onTab={setTab} output={output} verdict={verdict} />
          </>
        )}
      </section>
    </div>
  )
}

function TablesSection({ tables, textFallback, failed }: Loaded) {
  return (
    <details className="mb-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">Tables</summary>
      {tables.length === 0 && failed.length === 0 && <p className="mt-2 text-gray-500">No tables. Upload CSV files in the editor.</p>}
      <ul className="mt-2 space-y-2">
        {tables.map((t) => (
          <li key={t.name}>
            <span className="font-mono font-medium">{t.name}</span>
            <span className="ml-2 font-mono text-xs text-gray-600">{t.columns.map((c) => `${c.name} ${c.type}`).join(', ')}</span>
            {textFallback.includes(t.name) && (
              <span className="ml-2 text-xs text-amber-700">loaded as text: a value did not match the inferred types</span>
            )}
          </li>
        ))}
        {failed.map((f) => (
          <li key={f.name}>
            <span className="font-mono font-medium">{f.name}</span>
            <span className="ml-2 text-xs text-red-600">not loaded: {f.message}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
