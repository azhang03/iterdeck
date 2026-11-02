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
  return db
}

export function now(): string {
  return new Date().toISOString()
}
