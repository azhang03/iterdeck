import { createReadStream } from 'node:fs'
import { parse } from 'csv-parse'
import type { ColumnType } from '../shared/types.ts'
import { BadRequest } from './validate.ts'

const MAX_IDENT = 63
const SAMPLE_ROWS = 1000

// A PostgreSQL identifier made from a file or header name: lower-case, letters,
// digits, and underscores, and it starts with a letter or an underscore.
function identifier(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (s === '' || !/^[a-z_]/.test(s)) s = `t_${s}`
  return s.slice(0, MAX_IDENT)
}

export function tableName(fileName: string): string {
  return identifier(fileName.replace(/\.[^.]*$/, ''))
}

export function columnName(header: string, index: number): string {
  const base = header.trim()
  if (base === '') return `col_${index + 1}`
  return identifier(base)
}

const BIGINT = /^-?\d{1,18}$/
const NUMERIC = /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/
const BOOLEAN: Record<string, true> = { true: true, false: true, t: true, f: true, yes: true, no: true }
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[-+]\d{2}:?\d{2})?$/

// The narrowest type that every non-empty sample fits. Empty cells are NULL.
export function inferType(samples: string[]): ColumnType {
  const cells = samples.filter((s) => s !== '')
  if (cells.length === 0) return 'text'
  if (cells.every((c) => BIGINT.test(c))) return 'bigint'
  if (cells.every((c) => NUMERIC.test(c))) return 'numeric'
  if (cells.every((c) => BOOLEAN[c.toLowerCase()])) return 'boolean'
  if (cells.every((c) => DATE.test(c))) return 'date'
  if (cells.every((c) => TIMESTAMP.test(c))) return 'timestamptz'
  return 'text'
}

export type CsvInfo = { columns: { name: string; type: ColumnType }[]; row_count: number }

// Reads the header, samples the first rows for types, and counts all rows.
export async function inspectCsv(path: string): Promise<CsvInfo> {
  const parser = createReadStream(path).pipe(parse({ relax_column_count: true, bom: true }))
  let names: string[] | null = null
  let samples: string[][] = []
  let rowCount = 0
  for await (const record of parser as AsyncIterable<string[]>) {
    if (names === null) {
      names = record.map(columnName)
      const seen = new Set<string>()
      for (const n of names) {
        if (seen.has(n)) throw new BadRequest(`duplicate column name ${n}`)
        seen.add(n)
      }
      samples = names.map(() => [])
      continue
    }
    rowCount++
    if (rowCount <= SAMPLE_ROWS) {
      names.forEach((_, i) => samples[i].push(record[i] ?? ''))
    }
  }
  if (names === null) throw new BadRequest('the CSV has no header row')
  return {
    columns: names.map((name, i) => ({ name, type: inferType(samples[i]) })),
    row_count: rowCount,
  }
}
