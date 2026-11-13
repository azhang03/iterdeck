import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const schema = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8')

export type Db = Database.Database

export function openDb(file: string): Db {
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(schema)
  migrate(db)
  return db
}

// Columns added after the first release. CREATE TABLE IF NOT EXISTS does not
// add columns to a table that exists, so each one is added here when missing.
const ADDED_COLUMNS: { table: string; name: string; definition: string }[] = [
  { table: 'sets', name: 'language', definition: 'TEXT' },
  { table: 'cards', name: 'tests', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'cards', name: 'ordered', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'cards', name: 'code', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'cards', name: 'note', definition: "TEXT NOT NULL DEFAULT ''" },
]

function migrate(db: Db): void {
  for (const col of ADDED_COLUMNS) {
    const existing = db.pragma(`table_info(${col.table})`) as { name: string }[]
    if (existing.some((c) => c.name === col.name)) continue
    db.exec(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.definition}`)
  }
}

export function now(): string {
  return new Date().toISOString()
}
