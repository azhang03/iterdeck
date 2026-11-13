import { describe, expect, it } from 'vitest'
import { cardLabel, savedTallies, testsPassed, timeByCard, timeOf } from './scorecard.ts'

describe('cardLabel', () => {
  it('is the first line of a plain card', () => {
    expect(cardLabel('two_sum')).toBe('two_sum')
    expect(cardLabel('first line\nsecond line')).toBe('first line')
  })

  it('removes the markdown marks', () => {
    expect(cardLabel('**Q005 Coin-flip board game**')).toBe('Q005 Coin-flip board game')
    expect(cardLabel('# Title with `code` and a [link](https://example.com)')).toBe('Title with code and a link')
    expect(cardLabel('an *italic* word, 3 * 4, and __init__')).toBe('an italic word, 3 * 4, and __init__')
  })

  it('adds the first heading under the first line, so cards of one question differ', () => {
    const card = '**Q003 Corroborating reports**\n\nA long statement.\n\n### Follow-up 1: allow duplicates\n\nText.\n\n### Names for Run tests\n\n```python\nclass A: ...\n```'
    expect(cardLabel(card)).toBe('Q003 Corroborating reports \u00b7 Follow-up 1: allow duplicates')
  })

  it('skips blank lines and names an empty card', () => {
    expect(cardLabel('\n\n  term  \n')).toBe('term')
    expect(cardLabel('')).toBe('(empty)')
    expect(cardLabel('  \n ')).toBe('(empty)')
  })
})

describe('timeOf', () => {
  it('adds the measured times and counts them', () => {
    expect(timeOf([{ ms: 1000 }, { ms: null }, { ms: 2500 }])).toEqual({ total: 3500, count: 2 })
    expect(timeOf([])).toEqual({ total: 0, count: 0 })
  })
})

describe('timeByCard', () => {
  it('adds the times of a card that was shown more than once and leaves out a card with no time', () => {
    const times = timeByCard([{ cardId: 1, ms: 1000 }, { cardId: 2 }, { cardId: 1, ms: 500 }, { cardId: 3, ms: 0 }])
    expect([...times]).toEqual([
      [1, 1500],
      [3, 0],
    ])
  })
})

describe('testsPassed', () => {
  it('counts the cards that were run and the ones with every case passed', () => {
    expect(testsPassed([{ passed: 5, total: 5 }, null, { passed: 4, total: 5 }])).toEqual({ passed: 1, ran: 2 })
    expect(testsPassed([null])).toEqual({ passed: 0, ran: 0 })
  })
})

describe('savedTallies', () => {
  it('reads back the tallies that were saved with a snapshot', () => {
    const saved = JSON.parse(JSON.stringify({ index: 2, tallies: { 8: { passed: 2, total: 3 }, 9: { passed: 5, total: 5 } } }))
    expect(savedTallies(saved)).toEqual({ 8: { passed: 2, total: 3 }, 9: { passed: 5, total: 5 } })
  })

  it('gives none for a snapshot without tallies and leaves out a bad entry', () => {
    expect(savedTallies(null)).toEqual({})
    expect(savedTallies({ index: 2 })).toEqual({})
    expect(savedTallies({ tallies: 'x' })).toEqual({})
    expect(savedTallies({ tallies: { 8: { passed: '2', total: 3 }, x: { passed: 1, total: 1 }, 9: { passed: 1, total: 1 } } })).toEqual({ 9: { passed: 1, total: 1 } })
  })
})
