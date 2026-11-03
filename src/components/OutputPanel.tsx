import { useState } from 'react'
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
}

const MAX_ROWS = 200

// Under the editor: the last run's rows, text, or error, and the last Check or
// Run tests verdict. Fixed height; Hide leaves only the tab row.
export default function OutputPanel({ setId, language, tab, onTab, output, verdict }: Props) {
  const [open, setOpen] = useState(true)
  const tabClass = (t: OutputTab) =>
    `rounded px-2 py-0.5 text-xs ${tab === t ? 'bg-gray-200 font-medium' : 'text-gray-600 hover:bg-gray-100'}`
  return (
    <div className={`shrink-0 border-t border-gray-200 ${open ? 'h-56' : ''} flex flex-col`}>
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 px-3 py-1">
        <button type="button" onClick={() => onTab('output')} className={tabClass('output')}>
          Output
        </button>
        <button type="button" onClick={() => onTab('result')} className={tabClass('result')}>
          Result
        </button>
        {output && tab === 'output' && <span className="ml-auto text-xs text-gray-500">{output.ms} ms</span>}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${output && tab === 'output' ? 'ml-2' : 'ml-auto'} rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100`}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2 text-sm" aria-label={tab === 'output' ? 'Output' : 'Result'}>
          {tab === 'output' ? <Output output={output} /> : <Result setId={setId} language={language} verdict={verdict} />}
        </div>
      )}
    </div>
  )
}

function Output({ output }: { output: RunResult | null }) {
  if (!output) return <p className="text-gray-500">Press Run to see the output here.</p>
  if (!output.ok) {
    return (
      <>
        <p className="font-mono whitespace-pre-wrap text-red-600">
          {output.error.message}
          {output.error.line !== undefined && <span className="text-red-400"> (line {output.error.line})</span>}
        </p>
        {output.stdout && <pre className="mt-2 whitespace-pre-wrap text-gray-700">{output.stdout}</pre>}
      </>
    )
  }
  return (
    <>
      {output.rows && <RowTable rows={output.rows} />}
      {output.note && <p className="text-gray-700">{output.note}</p>}
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
              <th key={i} className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j} className={`border border-gray-200 px-2 py-1 ${v === null || v === undefined ? 'text-gray-400' : ''}`}>
                  {cellText(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-gray-500">
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

function Result({ setId, language, verdict }: { setId: number; language: Language; verdict: CheckResult | TestResult[] | null }) {
  if (verdict === null) {
    return (
      <p className="text-gray-500">
        {language === 'postgresql' ? 'Press Check to compare your query with the answer.' : 'Press Run tests to run the card\u2019s tests.'}
      </p>
    )
  }
  if (Array.isArray(verdict)) return <TestList setId={setId} results={verdict} />
  return (
    <>
      <p className={`font-medium ${verdict.ok ? 'text-green-700' : 'text-red-600'}`}>{verdict.message}</p>
      {!verdict.ok && verdict.expected && verdict.actual && (
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Expected</p>
            <RowTable rows={verdict.expected} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Yours</p>
            <RowTable rows={verdict.actual} />
          </div>
        </div>
      )}
    </>
  )
}

function TestList({ setId, results }: { setId: number; results: TestResult[] }) {
  if (results.length === 0) {
    return (
      <p className="text-gray-600">
        This card has no tests. Add some in the{' '}
        <Link to={`/sets/${setId}/edit`} className="text-blue-700 hover:underline">
          editor
        </Link>
        .
      </p>
    )
  }
  const passed = results.filter((r) => r.ok).length
  const all = passed === results.length
  return (
    <>
      <p className={`font-medium ${all ? 'text-green-700' : 'text-red-600'}`}>
        {passed} of {results.length} passed
      </p>
      <ul className="mt-2 space-y-1">
        {results.map((r, i) => (
          <li key={i}>
            <span className={r.ok ? 'text-green-700' : 'text-red-600'} aria-label={r.ok ? 'passed' : 'failed'}>
              {r.ok ? '\u2713' : '\u2717'}
            </span>{' '}
            <span className="font-mono text-xs">{r.name}</span>
            {!r.ok && r.error && (
              <p className="ml-5 font-mono text-xs text-red-600">
                {r.error.message}
                {r.error.line !== undefined && <span className="text-red-400"> (line {r.error.line} in the test)</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
