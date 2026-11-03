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

async function txid(db: PGlite): Promise<string> {
  const r = await db.query<{ id: string }>('SELECT txid_current()::text AS id')
  return r.rows[0].id
}

// PostgreSQL in the browser. Each set file becomes a table. Every run happens
// inside a transaction that is rolled back, so the data is the same each time.
export class SqlRunner implements Runner {
  private db: PGlite | null = null
  private set: SetWithCards | null = null
  private disposed = false
  private readonly fetchFile: (file: string) => Promise<Blob>
  // For the Tables section in the study layout.
  tables: Table[] = []
  // Tables whose CSV did not fit the inferred types and were loaded with text columns.
  textFallback: string[] = []
  // Tables that could not be loaded at all, with the error.
  failed: { name: string; message: string }[] = []

  constructor(options: Options = {}) {
    this.fetchFile = options.fetchFile ?? fetchFile
  }

  async prepare(set: SetWithCards): Promise<void> {
    if (this.db) return
    this.set = set
    const db = await PGlite.create('memory://')
    const tables: Table[] = []
    const textFallback: string[] = []
    const failed: { name: string; message: string }[] = []
    try {
      for (const file of set.files) {
        const name = file.table_name
        let columns = file.columns
        try {
          const blob = await this.fetchFile(file.file)
          try {
            await load(db, name, columns, blob)
          } catch {
            await db.exec(`DROP TABLE IF EXISTS ${quote(name)}`)
            columns = file.columns.map((c) => ({ name: c.name, type: 'text' as const }))
            await load(db, name, columns, blob)
            textFallback.push(name)
          }
          tables.push({ name, columns })
        } catch (err) {
          await db.exec(`DROP TABLE IF EXISTS ${quote(name)}`).catch(() => {})
          failed.push({ name, message: err instanceof Error ? err.message : String(err) })
        }
      }
    } catch (err) {
      await db.close().catch(() => {})
      throw err
    }
    // dispose ran while the data loaded: the layout unmounted.
    if (this.disposed) {
      await db.close().catch(() => {})
      return
    }
    this.db = db
    this.tables = tables
    this.textFallback = textFallback
    this.failed = failed
  }

  async run(code: string): Promise<RunResult> {
    const db = this.db
    if (!db) return { ok: false, error: { message: 'PostgreSQL is not loaded' }, stdout: '', ms: 0 }
    const start = performance.now()
    await db.exec('BEGIN')
    const txBefore = await txid(db)
    let result: RunResult
    try {
      const results = await db.exec(code, { rowMode: 'array' })
      const ms = Math.round(performance.now() - start)
      const withRows = results.filter((r) => r.fields.length > 0)
      const last = withRows[withRows.length - 1] as Results<unknown[]> | undefined
      if (last) {
        result = { ok: true, stdout: '', rows: { columns: last.fields.map((f) => f.name), values: last.rows }, note: null, ms }
      } else {
        const tail = results[results.length - 1]
        result = { ok: true, stdout: '', rows: null, note: `OK, ${tail?.affectedRows ?? 0} rows affected`, ms }
      }
    } catch (err) {
      result = { ok: false, error: sqlError(err, code), stdout: '', ms: Math.round(performance.now() - start) }
    }
    // A COMMIT, END, ROLLBACK, or ABORT in the code ends the transaction early, and
    // what follows is permanent. txid_current changes in that case (an aborted
    // transaction cannot answer; that counts as unchanged). The data is then rebuilt.
    const txAfter = await txid(db).catch(() => txBefore)
    await db.exec('ROLLBACK').catch(() => {})
    if (txAfter !== txBefore) {
      await this.reload()
      return {
        ok: false,
        error: { message: 'COMMIT, END, ROLLBACK, and ABORT are not allowed. The tables were reset.' },
        stdout: '',
        ms: result.ms,
      }
    }
    return result
  }

  private async reload(): Promise<void> {
    const set = this.set
    this.db?.close().catch(() => {})
    this.db = null
    if (set) await this.prepare(set)
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
