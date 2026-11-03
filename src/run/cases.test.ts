import { describe, expect, it } from 'vitest'
import { caseName, splitCases } from './cases.ts'

describe('splitCases', () => {
  it('splits on blank lines, trims, and drops empty cases', () => {
    expect(splitCases('a\n\nb\n  \n\n\nc\n')).toEqual(['a', 'b', 'c'])
    expect(splitCases('')).toEqual([])
    expect(splitCases('\n \n')).toEqual([])
  })

  it('keeps a multi-line case together and keeps its indentation', () => {
    expect(splitCases('x = f(1)\nassert x == 2\n\nassert f(0) == 0')).toEqual(['x = f(1)\nassert x == 2', 'assert f(0) == 0'])
    expect(splitCases('  x = 1\n  assert x')).toEqual(['  x = 1\n  assert x'])
  })

  it('normalises CRLF and splits on a line of non-breaking spaces', () => {
    expect(splitCases('a\r\n\r\nb')).toEqual(['a', 'b'])
    expect(splitCases('a\n\u00a0\nb')).toEqual(['a', 'b'])
  })
})

describe('caseName', () => {
  it('uses the first non-empty line, trimmed and cut at 60', () => {
    expect(caseName('\n  assert f() == 1  \nmore')).toBe('assert f() == 1')
    expect(caseName('x'.repeat(80))).toHaveLength(60)
  })
})
