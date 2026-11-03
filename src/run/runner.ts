import type { Card, Language, SetWithCards } from '../api.ts'
import { SqlRunner } from './sql.ts'

export type RunError = { message: string; line?: number; column?: number }
export type Rows = { columns: string[]; values: unknown[][] }
export type RunResult =
  | { ok: true; stdout: string; rows: Rows | null; note: string | null; ms: number }
  | { ok: false; error: RunError; stdout: string; ms: number }
export type CheckResult = { ok: boolean; message: string; expected: Rows | null; actual: Rows | null }
export type TestResult = { name: string; ok: boolean; error: RunError | null }
export type PrepareStatus = 'idle' | 'loading' | 'ready' | 'failed'

// One runner per study session. prepare loads the engine and the set's data;
// run executes the editor text; check compares a query with the card's back
// side (SQL); test runs the card's test cases (Python).
export interface Runner {
  prepare(set: SetWithCards): Promise<void>
  run(code: string): Promise<RunResult>
  check(code: string, card: Card): Promise<CheckResult>
  test(code: string, card: Card): Promise<TestResult[]>
  dispose(): void
}

export function createRunner(language: Language): Runner {
  if (language === 'postgresql') return new SqlRunner()
  throw new Error('python runner comes in F10')
}
