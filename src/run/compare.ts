import type { Rows } from './runner.ts'

const NULL = '\u2205'
const SEP = '\u0001'
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

// One text form per cell, so 1, "1", and 1.0 compare equal and NULL is distinct
// from the empty string.
export function cell(v: unknown): string {
  if (v === null || v === undefined) return NULL
  if (typeof v === 'boolean') return v ? 't' : 'f'
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string' && PLAIN_NUMBER.test(v)) return String(Number(v))
  return String(v)
}

export type Verdict = { ok: boolean; message: string }

// Column names do not matter; column count, row count, and cell values do.
// With ordered false, both row lists are sorted before the comparison.
export function sameRows(expected: Rows, actual: Rows, ordered: boolean): Verdict {
  if (expected.columns.length !== actual.columns.length) {
    return { ok: false, message: `Wrong: expected ${expected.columns.length} columns, got ${actual.columns.length}` }
  }
  if (expected.values.length !== actual.values.length) {
    return { ok: false, message: `Wrong: expected ${expected.values.length} rows, got ${actual.values.length}` }
  }
  const join = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(SEP))
  const a = join(expected.values)
  const b = join(actual.values)
  if (!ordered) {
    a.sort()
    b.sort()
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return { ok: false, message: ordered ? 'Wrong: the rows differ' : 'Wrong: the rows differ (order does not matter)' }
  }
  return { ok: true, message: 'Right' }
}
