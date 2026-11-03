import { describe, expect, it } from 'vitest'
import { cell, sameRows } from './compare.ts'

describe('cell', () => {
  it('normalises nulls, booleans, numbers, dates, and numeric strings', () => {
    expect(cell(null)).toBe(cell(undefined))
    expect(cell(null)).not.toBe(cell(''))
    expect(cell(true)).toBe('t')
    expect(cell(false)).toBe('f')
    expect(cell(1)).toBe(cell('1'))
    expect(cell('1.0')).toBe(cell(1))
    expect(cell('1.50')).toBe(cell('1.5'))
    expect(cell(10n)).toBe('10')
    expect(cell(new Date('2024-01-02T00:00:00Z'))).toBe('2024-01-02T00:00:00.000Z')
    expect(cell('abc')).toBe('abc')
    expect(cell('1e3')).toBe('1e3')
    expect(cell({ a: 1 })).not.toBe(cell({ a: 2 }))
    expect(cell(['a,b'])).not.toBe(cell(['a', 'b']))
    expect(cell([null])).not.toBe(cell(['']))
    expect(cell({ n: 10n })).toBe('{"n":"10"}')
    expect(() => cell(new Date('infinity'))).not.toThrow()
  })
})

describe('sameRows', () => {
  const rows = (values: unknown[][], columns = ['a', 'b']) => ({ columns, values })

  it('ignores column names and compares values', () => {
    expect(sameRows(rows([[1, 'x']]), rows([['1', 'x']], ['c', 'd']), true)).toEqual({ ok: true, message: 'Right' })
  })

  it('reports column and row count differences first', () => {
    expect(sameRows(rows([[1, 2]]), rows([[1]], ['a']), false).message).toBe('Wrong: expected 2 columns, got 1')
    expect(sameRows(rows([[1, 2]]), rows([]), false).message).toBe('Wrong: expected 1 rows, got 0')
  })

  it('sorts when order does not matter and not otherwise', () => {
    const a = rows([
      [1, 'x'],
      [2, 'y'],
    ])
    const b = rows([
      [2, 'y'],
      [1, 'x'],
    ])
    expect(sameRows(a, b, false).ok).toBe(true)
    expect(sameRows(a, b, true)).toEqual({ ok: false, message: 'Wrong: the rows differ' })
    expect(sameRows(a, rows([[1, 'x'], [2, 'z']]), false).message).toBe('Wrong: the rows differ (order does not matter)')
  })

  it('tells null from the empty string', () => {
    expect(sameRows(rows([[null, 1]]), rows([['', 1]]), true).ok).toBe(false)
  })
})
