import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Language } from '../api.ts'
import type { CheckResult, RunResult, Rows, TestResult } from '../run/runner.ts'

export type OutputTab = 'output' | 'result'

type Props = {
  setId: number
  language: Language
  tab: OutputTab
  onTab: (tab: OutputTab) => void
  output: RunResult | null
  verdict: CheckResult | TestResult[] | null
  // The number of the test run that `verdict` is from. A new number shows the cases one by one.
  testRun: number
}

const MAX_ROWS = 200
// The time between two test cases when a new run shows.
const CASE_STEP_MS = 110

// Under the editor: the last run's rows, text, or error, and the last Check or
// Run tests verdict. Fixed height; Hide leaves only the tab row.
export default function OutputPanel({ setId, language, tab, onTab, output, verdict, testRun }: Props) {
  const [open, setOpen] = useState(true)
  const root = useRef<HTMLDivElement>(null)
  // The run whose cases have come in. A later look at the Result tab shows them at once.
  const [shownRun, setShownRun] = useState(testRun)

  useEffect(() => {
    if (!Array.isArray(verdict) || verdict.length === 0) return
    const whole = verdict.length * CASE_STEP_MS
    const done = setTimeout(() => setShownRun(testRun), whole + 300)
    // All passed: the panel glows green one time, after the last case.
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-ok').trim()
    const glow = verdict.every((r) => r.ok)
      ? root.current?.animate([{ boxShadow: `inset 0 0 0 2px ${color}, inset 0 0 40px -12px ${color}` }, { boxShadow: 'inset 0 0 0 0 transparent' }], {
          duration: 1100,
          delay: whole,
          easing: 'ease-out',
        })
      : undefined
    // A new run must not show the glow of the run before it.
    return () => {
      clearTimeout(done)
      glow?.cancel()
    }
  }, [verdict, testRun])
  const tabClass = (t: OutputTab) =>
    `rounded px-2 py-0.5 text-xs ${tab === t ? 'bg-track font-medium' : 'text-muted hover:bg-hover'}`
  return (
    <div ref={root} className={`shrink-0 border-t border-line ${open ? 'h-56' : ''} flex flex-col`}>
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-1">
        <button type="button" onClick={() => onTab('output')} className={tabClass('output')}>
          Output
        </button>
        <button type="button" onClick={() => onTab('result')} className={tabClass('result')}>
          Result
        </button>
        {output && tab === 'output' && <span className="ml-auto text-xs text-muted">{output.ms} ms</span>}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${output && tab === 'output' ? 'ml-2' : 'ml-auto'} rounded px-2 py-0.5 text-xs text-muted hover:bg-hover`}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2 text-sm" aria-label={tab === 'output' ? 'Output' : 'Result'}>
          {tab === 'output' ? <Output output={output} /> : <Result setId={setId} language={language} verdict={verdict} testRun={testRun} staged={shownRun !== testRun} />}
        </div>
      )}
    </div>
  )
}

function Output({ output }: { output: RunResult | null }) {
  if (!output) return <p className="text-muted">Press Run to see the output here.</p>
  if (!output.ok) {
    return (
      <>
        <p className="font-mono whitespace-pre-wrap text-bad">
          {output.error.message}
          {output.error.line !== undefined && <span className="text-bad/70"> (line {output.error.line})</span>}
        </p>
        {output.stdout && <pre className="mt-2 whitespace-pre-wrap text-ink">{output.stdout}</pre>}
      </>
    )
  }
  return (
    <>
      {output.rows && <RowTable rows={output.rows} />}
      {output.note && <p className="text-ink">{output.note}</p>}
      {!output.rows && !output.note && <pre className="whitespace-pre-wrap">{output.stdout || '(no output)'}</pre>}
      {output.rows && output.stdout && <pre className="mt-2 whitespace-pre-wrap">{output.stdout}</pre>}
    </>
  )
}

function RowTable({ rows }: { rows: Rows }) {
  const shown = rows.values.slice(0, MAX_ROWS)
  return (
    <>
      <table className="border-collapse font-mono text-xs">
        <thead>
          <tr>
            {rows.columns.map((c, i) => (
              <th key={i} className="border border-line bg-page px-2 py-1 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j} className={`border border-line px-2 py-1 ${v === null || v === undefined ? 'text-muted' : ''}`}>
                  {cellText(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted">
        {shown.length < rows.values.length ? `${shown.length} of ${rows.values.length} rows shown` : `${rows.values.length} ${rows.values.length === 1 ? 'row' : 'rows'}`}
      </p>
    </>
  )
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? String(v) : v.toISOString()
  if (typeof v === 'object') return JSON.stringify(v, (_, x: unknown) => (typeof x === 'bigint' ? String(x) : x))
  return String(v)
}

type ResultProps = { setId: number; language: Language; verdict: CheckResult | TestResult[] | null; testRun: number; staged: boolean }

function Result({ setId, language, verdict, testRun, staged }: ResultProps) {
  if (verdict === null) {
    return (
      <p className="text-muted">
        {language === 'postgresql' ? 'Press Check to compare your query with the answer.' : 'Press Run tests to run the card\u2019s tests.'}
      </p>
    )
  }
  // The key starts the entrance again for each run.
  if (Array.isArray(verdict)) return <TestList key={testRun} setId={setId} results={verdict} staged={staged} />
  return (
    <>
      <p className={`font-medium ${verdict.ok ? 'text-ok' : 'text-bad'}`}>{verdict.message}</p>
      {!verdict.ok && verdict.expected && verdict.actual && (
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Expected</p>
            <RowTable rows={verdict.expected} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Yours</p>
            <RowTable rows={verdict.actual} />
          </div>
        </div>
      )}
    </>
  )
}

// `staged` shows the cases one by one, then the count.
function TestList({ setId, results, staged }: { setId: number; results: TestResult[]; staged: boolean }) {
  if (results.length === 0) {
    return (
      <p className="text-muted">
        This card has no tests. Add some in the{' '}
        <Link to={`/sets/${setId}/edit`} className="text-accent hover:underline">
          editor
        </Link>
        .
      </p>
    )
  }
  const passed = results.filter((r) => r.ok).length
  const all = passed === results.length
  const entrance = staged ? 'motion-safe:animate-case-in' : ''
  const delay = (step: number) => (staged ? { animationDelay: `${step * CASE_STEP_MS}ms` } : undefined)
  return (
    <>
      <p style={delay(results.length)} className={`font-medium ${all ? 'text-ok' : 'text-bad'} ${entrance}`}>
        {passed} of {results.length} passed
      </p>
      <ul className="mt-2 space-y-1">
        {results.map((r, i) => (
          <li key={i} style={delay(i)} className={entrance}>
            <span className={r.ok ? 'text-ok' : 'text-bad'} aria-label={r.ok ? 'passed' : 'failed'}>
              {r.ok ? '\u2713' : '\u2717'}
            </span>{' '}
            <span className="font-mono text-xs">{r.name}</span>
            {!r.ok && r.error && (
              <p className="ml-5 font-mono text-xs text-bad">
                {r.error.message}
                {r.error.line !== undefined && <span className="text-bad/70"> (line {r.error.line} in the test)</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
