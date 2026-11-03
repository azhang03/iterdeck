import { PGlite, type Results } from '@electric-sql/pglite'
import type { Card, SetFile, SetWithCards } from '../api.ts'
import { sameRows } from './compare.ts'
import type { CheckResult, RunError, RunResult, Runner, TestResult } from './runner.ts'

export type Table = { name: string; columns: SetFile['columns'] }

type Options = {
  // Where a set file's CSV comes from. The default fetches /files/<file>; tests pass strings.
  fetchFile?: (file: string) => Promise<Blob>
}

const quote = (ident: string) => `"${ident.replace(/"/g, '""')}"`

async function fetchFile(file: string): Promise<Blob> {
  const res = await fetch(`/files/${file}`)
  if (!res.ok) throw new Error(`could not load ${file}: ${res.status}`)
  return res.blob()
}

async function load(db: PGlite, name: string, columns: SetFile['columns'], blob: Blob): Promise<void> {
  const cols = columns.map((c) => `${quote(c.name)} ${c.type}`).join(', ')
  await db.exec(`CREATE TABLE ${quote(name)} (${cols})`)
  await db.query(`COPY ${quote(name)} FROM '/dev/blob' WITH (FORMAT csv, HEADER true)`, [], { blob })
}

// PostgreSQL in the browser. Each set file becomes a table. Every run happens
// inside a transaction that is rolled back, so the data is the same each time.
export class SqlRunner implements Runner {
  private db: PGlite | null = null
  private disposed = false
  private readonly fetchFile: (file: string) => Promise<Blob>
  // For the Tables section in the study layout.
  tables: Table[] = []
  // Tables whose CSV did not fit the inferred types and were loaded with text columns.
  textFallback: string[] = []

  constructor(options: Options = {}) {
    this.fetchFile = options.fetchFile ?? fetchFile
  }

  async prepare(set: SetWithCards): Promise<void> {
    if (this.db) return
    const db = await PGlite.create('memory://')
    const tables: Table[] = []
    const textFallback: string[] = []
    for (const file of set.files) {
      const blob = await this.fetchFile(file.file)
      let columns = file.columns
      try {
        await load(db, file.table_name, columns, blob)
      } catch {
        await db.exec(`DROP TABLE IF EXISTS ${quote(file.table_name)}`)
        columns = file.columns.map((c) => ({ name: c.name, type: 'text' as const }))
        await load(db, file.table_name, columns, blob)
        textFallback.push(file.table_name)
      }
      tables.push({ name: file.table_name, columns })
    }
    // dispose ran while the data loaded: the layout unmounted.
    if (this.disposed) {
      await db.close().catch(() => {})
      return
    }
    this.db = db
    this.tables = tables
    this.textFallback = textFallback
  }

  async run(code: string): Promise<RunResult> {
    const db = this.db
    if (!db) return { ok: false, error: { message: 'PostgreSQL is not loaded' }, stdout: '', ms: 0 }
    const start = performance.now()
    await db.exec('BEGIN')
    try {
      const results = await db.exec(code, { rowMode: 'array' })
      const ms = Math.round(performance.now() - start)
      const withRows = results.filter((r) => r.fields.length > 0)
      const last = withRows[withRows.length - 1] as Results<unknown[]> | undefined
      if (last) {
        return { ok: true, stdout: '', rows: { columns: last.fields.map((f) => f.name), values: last.rows }, note: null, ms }
      }
      const tail = results[results.length - 1]
      return { ok: true, stdout: '', rows: null, note: `OK, ${tail?.affectedRows ?? 0} rows affected`, ms }
    } catch (err) {
      return { ok: false, error: sqlError(err, code), stdout: '', ms: Math.round(performance.now() - start) }
    } finally {
      await db.exec('ROLLBACK').catch(() => {})
    }
  }

  // The back of the card holds the reference query. Both run; the rows are compared.
  async check(code: string, card: Card): Promise<CheckResult> {
    const actual = await this.run(code)
    if (!actual.ok) return { ok: false, message: actual.error.message, expected: null, actual: null }
    const expected = await this.run(card.definition)
    if (!expected.ok) {
      return { ok: false, message: `The reference query on the back of the card fails: ${expected.error.message}`, expected: null, actual: actual.rows }
    }
    if (!actual.rows || !expected.rows) {
      return { ok: false, message: 'The query returned no result set', expected: expected.rows, actual: actual.rows }
    }
    const verdict = sameRows(expected.rows, actual.rows, card.ordered === 1)
    return { ...verdict, expected: expected.rows, actual: actual.rows }
  }

  async test(): Promise<TestResult[]> {
    return []
  }

  dispose(): void {
    this.disposed = true
    this.db?.close().catch(() => {})
    this.db = null
  }
}

// PostgreSQL reports a 1-based character offset for syntax errors. It becomes a
// line and column in the editor text.
export function sqlError(err: unknown, code: string): RunError {
  const message = err instanceof Error ? err.message : String(err)
  const position = err instanceof Error && 'position' in err ? err.position : undefined
  if (typeof position !== 'string' || !/^\d+$/.test(position)) return { message }
  const offset = Math.min(Number(position) - 1, code.length)
  const before = code.slice(0, offset)
  const line = before.split('\n').length
  const column = offset - before.lastIndexOf('\n')
  return { message, line, column }
}
