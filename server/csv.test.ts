import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { columnName, inferType, inspectCsv, tableName } from './csv.ts'

describe('names', () => {
  it('makes table names from file names', () => {
    expect(tableName('Sales Data 2024.csv')).toBe('sales_data_2024')
    expect(tableName('1st.csv')).toBe('t_1st')
    expect(tableName('__weird--name__.CSV')).toBe('weird_name')
    expect(tableName('.csv')).toBe('t_')
    expect(tableName('a'.repeat(80) + '.csv')).toHaveLength(63)
  })

  it('makes column names from headers', () => {
    expect(columnName('Unit Price ($)', 0)).toBe('unit_price')
    expect(columnName('', 2)).toBe('col_3')
    expect(columnName('   ', 0)).toBe('col_1')
    expect(columnName('2nd', 0)).toBe('t_2nd')
    expect(columnName('#', 0)).toBe('col_1')
    expect(columnName('%', 1)).toBe('col_2')
  })
})

describe('inferType', () => {
  it('picks the narrowest type that fits every non-empty cell', () => {
    expect(inferType(['1', '-20', ''])).toBe('bigint')
    expect(inferType(['1', '2.5'])).toBe('numeric')
    expect(inferType(['.5', '1e3', '-2.'])).toBe('numeric')
    expect(inferType(['true', 'F', 'yes', ''])).toBe('boolean')
    expect(inferType(['2024-01-02', ''])).toBe('date')
    expect(inferType(['2024-01-02T10:00:00Z', '2024-01-02 10:00'])).toBe('timestamptz')
    expect(inferType(['2024-01-02', 'soon'])).toBe('text')
    expect(inferType(['', ''])).toBe('text')
    expect(inferType([])).toBe('text')
    // 19 digits is past bigint's range check and lands on numeric.
    expect(inferType(['1234567890123456789'])).toBe('numeric')
  })
})

describe('inspectCsv', () => {
  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'iterdeck-csv-'))
  })
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })
  const file = (name: string, body: string) => {
    const path = join(dir, name)
    writeFileSync(path, body)
    return path
  }

  it('reads the header, infers types, treats empty cells as null, and keeps quoted commas', async () => {
    const info = await inspectCsv(file('a.csv', 'id,name,price,active,day\n1,a,1.5,true,2024-01-02\n2,"b, c",,f,\n'))
    expect(info.columns).toEqual([
      { name: 'id', type: 'bigint' },
      { name: 'name', type: 'text' },
      { name: 'price', type: 'numeric' },
      { name: 'active', type: 'boolean' },
      { name: 'day', type: 'date' },
    ])
    expect(info.row_count).toBe(2)
  })

  it('strips a BOM, skips blank lines, and rejects a short row', async () => {
    const info = await inspectCsv(file('b.csv', '\uFEFFx,y\n1,2\n\n2,3\n\n'))
    expect(info.columns).toEqual([
      { name: 'x', type: 'bigint' },
      { name: 'y', type: 'bigint' },
    ])
    expect(info.row_count).toBe(2)
    await expect(inspectCsv(file('short.csv', 'x,y\n1\n'))).rejects.toMatchObject({ status: 400 })
  })

  it('rejects a broken quote with 400', async () => {
    await expect(inspectCsv(file('quote.csv', 'a,b\n1,"open\n'))).rejects.toMatchObject({ status: 400 })
  })

  it('does not read inherited object keys as booleans', () => {
    expect(inferType(['constructor', 'toString'])).toBe('text')
  })

  it('counts rows past the sample window', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => String(i)).join('\n')
    const info = await inspectCsv(file('c.csv', `n\n${rows}\n`))
    expect(info.row_count).toBe(1500)
  })

  it('rejects a duplicate column name after normalisation', async () => {
    await expect(inspectCsv(file('d.csv', 'Name,name\n1,2\n'))).rejects.toMatchObject({
      status: 400,
      message: 'duplicate column name name',
    })
  })

  it('rejects a file with no header row', async () => {
    await expect(inspectCsv(file('e.csv', ''))).rejects.toMatchObject({ status: 400, message: 'the CSV has no header row' })
  })
})
