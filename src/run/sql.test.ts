import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Card, SetFile, SetWithCards } from '../api.ts'
import { SqlRunner, sqlError } from './sql.ts'

const FILES: Record<string, string> = {
  'employees.csv': 'id,name,dept_id,salary\n1,Ann,1,70000\n2,Bob,1,40000\n3,Cid,2,52000.50\n4,Dee,2,\n',
  'departments.csv': 'id,name\n1,Eng\n2,Ops\n',
  'events.csv': 'id,day\n1,2024-01-02\n2,not a date\n',
}

function setFile(id: number, table: string, columns: SetFile['columns']): SetFile {
  return { id, set_id: 1, table_name: table, file: `${table}.csv`, columns, row_count: 0, size: 0, created_at: '' }
}

function makeSet(files: SetFile[]): SetWithCards {
  return {
    id: 1,
    title: 't',
    folder_id: null,
    code_mode: 1,
    language: 'postgresql',
    created_at: '',
    updated_at: '',
    last_used_at: '',
    folder: null,
    cards: [],
    files,
    progress: { flashcards: null, learn: null },
  }
}

function card(definition: string, ordered: 0 | 1 = 0): Card {
  return {
    id: 1,
    set_id: 1,
    position: 0,
    term: '',
    definition,
    term_image_id: null,
    definition_image_id: null,
    term_image_url: null,
    definition_image_url: null,
    starred: 0,
    checked_count: 0,
    sorted_count: 0,
    tests: '',
    ordered,
    code: '',
    note: '',
    created_at: '',
  }
}

const fetchFile = async (file: string) => new Blob([FILES[file]])

describe('SqlRunner', () => {
  const runner = new SqlRunner({ fetchFile })

  beforeAll(async () => {
    await runner.prepare(
      makeSet([
        setFile(1, 'employees', [
          { name: 'id', type: 'bigint' },
          { name: 'name', type: 'text' },
          { name: 'dept_id', type: 'bigint' },
          { name: 'salary', type: 'numeric' },
        ]),
        setFile(2, 'departments', [
          { name: 'id', type: 'bigint' },
          { name: 'name', type: 'text' },
        ]),
      ]),
    )
  })

  afterAll(() => runner.dispose())

  it('loads the tables and runs a join', async () => {
    const r = await runner.run(
      'SELECT d.name, COUNT(*) AS n FROM employees e JOIN departments d ON d.id = e.dept_id GROUP BY d.name ORDER BY d.name',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows?.columns).toEqual(['name', 'n'])
    expect(r.rows?.values).toEqual([
      ['Eng', 2],
      ['Ops', 2],
    ])
    expect(r.note).toBeNull()
  })

  it('keeps an empty cell as NULL and a numeric as a numeric', async () => {
    const r = await runner.run('SELECT salary FROM employees WHERE id IN (3, 4) ORDER BY id')
    expect(r.ok && r.rows?.values).toEqual([['52000.50'], [null]])
  })

  it('returns a note and no rows for a statement without a result set', async () => {
    const r = await runner.run("UPDATE employees SET name = 'x' WHERE dept_id = 1")
    expect(r.ok && r.rows).toBeNull()
    expect(r.ok && r.note).toBe('OK, 2 rows affected')
  })

  it('rolls back after each run', async () => {
    await runner.run("INSERT INTO employees VALUES (99, 'x', 1, 1)")
    const r = await runner.run('SELECT COUNT(*) FROM employees')
    expect(r.ok && r.rows?.values).toEqual([[4]])
  })

  it('resets the tables when the code commits, and reports it', async () => {
    const r = await runner.run('COMMIT; DELETE FROM employees')
    expect(!r.ok && r.error.message).toContain('not allowed')
    const after = await runner.run('SELECT COUNT(*) FROM employees')
    expect(after.ok && after.rows?.values).toEqual([[4]])
  })

  it('reports a syntax error with its line', async () => {
    const r = await runner.run('SELECT 1;\nSELEC 2')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.message).toContain('syntax error')
    expect(r.error.line).toBe(2)
    expect(r.error.column).toBe(1)
  })

  it('check says Right for the same rows with other aliases and order when unordered', async () => {
    const reference = card('SELECT name FROM employees WHERE salary > 50000 ORDER BY name')
    const r = await runner.check('SELECT name AS who FROM employees WHERE salary > 50000 ORDER BY name DESC', reference)
    expect(r).toMatchObject({ ok: true, message: 'Right' })
    expect(r.expected?.values).toEqual([['Ann'], ['Cid']])
    expect(r.actual?.values).toEqual([['Cid'], ['Ann']])
  })

  it('check says Wrong when the order differs and the card is ordered', async () => {
    const reference = card('SELECT name FROM employees WHERE salary > 50000 ORDER BY name', 1)
    const r = await runner.check('SELECT name FROM employees WHERE salary > 50000 ORDER BY name DESC', reference)
    expect(r).toMatchObject({ ok: false, message: 'Wrong: the rows differ' })
  })

  it('check reports a failing user query, a failing reference, and no result set', async () => {
    const reference = card('SELECT 1')
    expect((await runner.check('SELEC 1', reference)).message).toContain('syntax error')
    expect((await runner.check('SELECT 1', card('SELEC 1'))).message).toContain('The reference query on the back of the card fails')
    expect((await runner.check("UPDATE employees SET name = 'x'", reference)).message).toBe('The query returned no result set')
  })

  it('run before prepare reports that PostgreSQL is not loaded', async () => {
    const fresh = new SqlRunner({ fetchFile })
    const r = await fresh.run('SELECT 1')
    expect(!r.ok && r.error.message).toBe('PostgreSQL is not loaded')
  })
})

describe('SqlRunner text fallback', () => {
  it('loads a table as text when a value does not fit the inferred type', async () => {
    const runner = new SqlRunner({ fetchFile })
    await runner.prepare(
      makeSet([
        setFile(3, 'events', [
          { name: 'id', type: 'bigint' },
          { name: 'day', type: 'date' },
        ]),
      ]),
    )
    expect(runner.textFallback).toEqual(['events'])
    expect(runner.tables[0].columns.map((c) => c.type)).toEqual(['text', 'text'])
    const r = await runner.run('SELECT day FROM events ORDER BY id')
    expect(r.ok && r.rows?.values).toEqual([['2024-01-02'], ['not a date']])
    runner.dispose()
  })

  it('skips a table whose file cannot be read and loads the rest', async () => {
    const runner = new SqlRunner({
      fetchFile: async (file) => {
        if (file === 'missing.csv') throw new Error('404')
        return new Blob([FILES[file]])
      },
    })
    await runner.prepare(
      makeSet([
        setFile(4, 'missing', [{ name: 'id', type: 'bigint' }]),
        setFile(5, 'departments', [
          { name: 'id', type: 'bigint' },
          { name: 'name', type: 'text' },
        ]),
      ]),
    )
    expect(runner.failed).toEqual([{ name: 'missing', message: '404' }])
    expect(runner.tables.map((t) => t.name)).toEqual(['departments'])
    const r = await runner.run('SELECT COUNT(*) FROM departments')
    expect(r.ok && r.rows?.values).toEqual([[2]])
    runner.dispose()
  })
})

describe('sqlError', () => {
  it('maps a position to a line and column', () => {
    const err = Object.assign(new Error('boom'), { position: '12' })
    expect(sqlError(err, 'SELECT 1;\nSELEC 2')).toEqual({ message: 'boom', line: 2, column: 2 })
    expect(sqlError(new Error('plain'), 'x')).toEqual({ message: 'plain' })
    expect(sqlError(Object.assign(new Error('e'), { position: '99' }), 'ab')).toEqual({ message: 'e', line: 1, column: 3 })
  })
})
