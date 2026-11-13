import type { ReactNode } from 'react'
import { formatClock } from '../study/clock.ts'
import type { TestTally } from '../study/scorecard.ts'

export type ScoreRow = {
  key: number
  label: string
  result: ReactNode
  // The time on the card, or null when it was not measured (a session from before the scorecard).
  ms: number | null
  // The card's last test run, or null when the tests were not run.
  tests: TestTally | null
}

type Props = {
  // The numbers at the top: a value and what it is.
  stats: { value: string; label: string }[]
  rows: ScoreRow[]
  // Code mode shows the tests of each card.
  showTests: boolean
}

// The table at the end of a round or a group: each card with its result, the
// time on it, and its tests. The rows come in one by one.
export default function Scorecard({ stats, rows, showTests }: Props) {
  return (
    <>
      <dl className="my-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-line bg-page px-2 py-2.5 text-center">
            <dd className="text-xl font-semibold tabular-nums">{s.value}</dd>
            <dt className="text-xs text-muted">{s.label}</dt>
          </div>
        ))}
      </dl>
      <table className="mb-5 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="text-xs tracking-wide text-muted uppercase">
            <th className="border-b border-line px-2 py-1.5 font-semibold">Card</th>
            <th className="border-b border-line px-2 py-1.5 font-semibold">Result</th>
            <th className="border-b border-line px-2 py-1.5 font-semibold">Time</th>
            {showTests && <th className="border-b border-line px-2 py-1.5 font-semibold">Tests</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className="motion-safe:animate-case-in" style={{ animationDelay: `${i * 55}ms` }}>
              <td className="w-full max-w-0 truncate border-b border-line px-2 py-2" title={r.label}>
                {r.label}
              </td>
              <td className="border-b border-line px-2 py-2 whitespace-nowrap">{r.result}</td>
              <td className="border-b border-line px-2 py-2 font-mono whitespace-nowrap tabular-nums">{r.ms === null ? <span className="text-muted">not timed</span> : formatClock(r.ms)}</td>
              {showTests && (
                <td className="border-b border-line px-2 py-2 font-mono whitespace-nowrap tabular-nums">
                  {r.tests ? <span className={r.tests.passed === r.tests.total ? 'text-ok' : 'text-bad'}>{`${r.tests.passed} of ${r.tests.total}`}</span> : <span className="text-muted">not run</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
