import { describe, expect, it } from 'vitest'
import { splitCases } from './cases.ts'

describe('splitCases', () => {
  it('splits on blank lines, trims, and drops empty cases', () => {
    expect(splitCases('a\n\nb\n  \n\n\nc\n')).toEqual(['a', 'b', 'c'])
    expect(splitCases('')).toEqual([])
    expect(splitCases('\n \n')).toEqual([])
  })

  it('keeps a multi-line case together', () => {
    expect(splitCases('x = f(1)\nassert x == 2\n\nassert f(0) == 0')).toEqual(['x = f(1)\nassert x == 2', 'assert f(0) == 0'])
  })
})
