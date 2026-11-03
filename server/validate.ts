import type { Language, ListSort } from '../shared/types.ts'

export class BadRequest extends Error {
  status = 400
}

export class NotFound extends Error {
  status = 404
  constructor(what: string) {
    super(`${what} not found`)
  }
}

export function text(v: unknown, field: string, max = 10000): string {
  if (typeof v !== 'string') throw new BadRequest(`${field} must be a string`)
  if (v.length > max) throw new BadRequest(`${field} is longer than ${max} characters`)
  return v
}

export function nonEmptyText(v: unknown, field: string, max = 200): string {
  const s = text(v, field, max).trim()
  if (s === '') throw new BadRequest(`${field} must not be empty`)
  return s
}

export function id(v: unknown, field: string): number {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) throw new BadRequest(`${field} must be a positive integer`)
  return n
}

export function idOrNull(v: unknown, field: string): number | null {
  if (v === null || v === undefined) return null
  return id(v, field)
}

export function bool(v: unknown, field: string): 0 | 1 {
  if (typeof v !== 'boolean') throw new BadRequest(`${field} must be a boolean`)
  return v ? 1 : 0
}

const LANGUAGES: Language[] = ['python', 'postgresql']

export function language(v: unknown): Language | null {
  if (v === null) return null
  if (typeof v !== 'string' || !LANGUAGES.includes(v as Language)) throw new BadRequest('language must be python or postgresql')
  return v as Language
}

const SORTS: ListSort[] = ['created', 'used', 'name']

export function listSort(v: unknown): ListSort {
  if (v === undefined) return 'used'
  if (typeof v !== 'string' || !SORTS.includes(v as ListSort)) throw new BadRequest(`sort must be one of ${SORTS.join(', ')}`)
  return v as ListSort
}

export function orderBy(sort: ListSort, nameColumn: string): string {
  switch (sort) {
    case 'created':
      return 'created_at DESC, id DESC'
    case 'used':
      return 'last_used_at DESC, id DESC'
    case 'name':
      return `${nameColumn} COLLATE NOCASE ASC, id ASC`
  }
}

export function query(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}
