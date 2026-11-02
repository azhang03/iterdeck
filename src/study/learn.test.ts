import { describe, expect, it } from 'vitest'
import type { Card } from '../api.ts'
import { current, proceed, restart, roundSummary, segments, shuffle, sort, start, undo, type LearnState } from './learn.ts'

function card(id: number): Card {
  return {
    id,
    set_id: 1,
    position: id - 1,
    term: `t${id}`,
    definition: `d${id}`,
    term_image_id: null,
    definition_image_id: null,
    term_image_url: null,
    definition_image_url: null,
    starred: 0,
    checked_count: 0,
    sorted_count: 0,
    created_at: '',
  }
}

const deck = (count: number) => Array.from({ length: count }, (_, i) => card(i + 1))
const ids = (cards: Card[]) => cards.map((c) => c.id)

// Sorts the whole round: checked for every card except the ids in miss.
function playRound(s: LearnState, miss: number[]): LearnState {
  while (s.phase === 'round') {
    const c = current(s)!
    s = sort(s, !miss.includes(c.id))
  }
  return s
}

describe('groups', () => {
  it('splits 15 cards with n 7 into groups of 7, 7, 1 and ends done', () => {
    let s = start(deck(15), 7)
    expect(ids(s.group)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(segments(s)).toEqual([
      { size: 7, done: 0 },
      { size: 7, done: 0 },
      { size: 1, done: 0 },
    ])
    s = proceed(playRound(s, []))
    expect(s.groupIndex).toBe(1)
    expect(ids(s.group)).toEqual([8, 9, 10, 11, 12, 13, 14])
    s = proceed(playRound(s, []))
    expect(ids(s.group)).toEqual([15])
    s = proceed(playRound(s, []))
    expect(s.phase).toBe('done')
    expect(segments(s)).toEqual([
      { size: 7, done: 7 },
      { size: 7, done: 7 },
      { size: 1, done: 1 },
    ])
  })

  it('2 right of 7 loops the 5 missed, then the 3 missed of those', () => {
    let s = start(deck(7), 7)
    s = playRound(s, [2, 3, 5, 6, 7])
    expect(s.phase).toBe('debrief')
    expect(ids(roundSummary(s).checked)).toEqual([1, 4])
    expect(ids(roundSummary(s).missed)).toEqual([2, 3, 5, 6, 7])
    s = proceed(s)
    expect(ids(s.queue)).toEqual([2, 3, 5, 6, 7])
    expect(s.roundInGroup).toBe(2)
    expect(segments(s)[0]).toEqual({ size: 7, done: 2 })
    s = proceed(playRound(s, [3, 6, 7]))
    expect(ids(s.queue)).toEqual([3, 6, 7])
    s = proceed(playRound(s, []))
    expect(s.phase).toBe('done')
  })

  it('an empty deck is done at once', () => {
    expect(start([], 7).phase).toBe('done')
  })

  it('a deck smaller than n is one group', () => {
    const s = start(deck(3), 7)
    expect(ids(s.group)).toEqual([1, 2, 3])
    expect(segments(s)).toEqual([{ size: 3, done: 0 }])
  })
})

describe('one-card rule', () => {
  it('matches the spec example: miss 5 twice, next group is 8 to 13 plus 5', () => {
    let s = start(deck(13), 7)
    s = proceed(playRound(s, [5]))
    expect(ids(s.queue)).toEqual([5])
    expect(s.solo).toBe(true)
    expect(ids(s.group)).toEqual([1, 2, 3, 4, 5, 6, 7])
    s = proceed(playRound(s, [5]))
    expect(s.groupIndex).toBe(1)
    expect(ids(s.group)).toEqual([8, 9, 10, 11, 12, 13, 5])
    expect(ids(s.queue)).toEqual([8, 9, 10, 11, 12, 13, 5])
    expect(s.solo).toBe(false)
    expect(segments(s)).toEqual([
      { size: 7, done: 7 },
      { size: 7, done: 0 },
    ])
  })

  it('a card checked on its second chance clears the group', () => {
    let s = start(deck(14), 7)
    s = proceed(playRound(s, [5]))
    s = proceed(playRound(s, []))
    expect(ids(s.group)).toEqual([8, 9, 10, 11, 12, 13, 14])
  })

  it('the carried card follows the same rule in its new group', () => {
    let s = start(deck(14), 7)
    s = proceed(playRound(s, [5]))
    s = proceed(playRound(s, [5]))
    expect(ids(s.group)).toEqual([8, 9, 10, 11, 12, 13, 5])
    s = proceed(playRound(s, [5]))
    expect(ids(s.queue)).toEqual([5])
    expect(s.solo).toBe(true)
    s = proceed(playRound(s, [5]))
    expect(ids(s.group)).toEqual([14, 5])
  })

  it('with no cards left, a twice-missed card keeps getting solo rounds until checked', () => {
    let s = start(deck(1), 7)
    s = proceed(playRound(s, [1]))
    expect(ids(s.queue)).toEqual([1])
    s = proceed(playRound(s, [1]))
    expect(s.phase).toBe('round')
    expect(ids(s.queue)).toEqual([1])
    s = proceed(playRound(s, []))
    expect(s.phase).toBe('done')
  })

  it('a group of one at the end follows the same rules', () => {
    let s = start(deck(8), 7)
    s = proceed(playRound(s, []))
    expect(ids(s.group)).toEqual([8])
    s = proceed(playRound(s, [8]))
    expect(s.solo).toBe(true)
    s = proceed(playRound(s, []))
    expect(s.phase).toBe('done')
  })
})

describe('undo and shuffle', () => {
  it('undo steps back within the round and from the debrief, and uncleared a checked card', () => {
    let s = start(deck(2), 7)
    s = sort(s, true)
    s = sort(s, false)
    expect(s.phase).toBe('debrief')
    s = undo(s)
    expect(s.phase).toBe('round')
    expect(current(s)?.id).toBe(2)
    s = undo(s)
    expect(current(s)?.id).toBe(1)
    expect(s.cleared).toEqual([])
    expect(undo(s)).toBe(s)
  })

  it('shuffle reorders only the cards not yet grouped', () => {
    let s = start(deck(14), 7)
    s = shuffle(s, () => 0)
    expect(ids(s.group)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(ids(s.remaining).sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14])
    expect(ids(s.remaining)).not.toEqual([8, 9, 10, 11, 12, 13, 14])
  })

  it('restart returns to the first group', () => {
    let s = start(deck(14), 7)
    s = proceed(playRound(s, []))
    s = restart(s)
    expect(s.groupIndex).toBe(0)
    expect(ids(s.group)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
