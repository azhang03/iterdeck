import { describe, expect, it } from 'vitest'
import type { Card } from '../api.ts'
import { canShuffle, cleared, current, groupSummary, isSolo, proceed, restart, segments, shuffle, sort, start, undo, type LearnState } from './learn.ts'

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
    tests: '',
    ordered: 0,
    code: '',
    created_at: '',
  }
}

const deck = (count: number) => Array.from({ length: count }, (_, i) => card(i + 1))
const ids = (cards: Card[]) => cards.map((c) => c.id)

// Sorts every card of the current pass: checked, except the ids in miss.
function playPass(s: LearnState, miss: number[]): LearnState {
  const count = s.queue.length - s.index
  for (let i = 0; i < count; i++) s = sort(s, !miss.includes(current(s)!.id))
  return s
}

// Sorts until the debrief: checked, except the ids in miss (missed every time they appear).
function playGroup(s: LearnState, miss: number[] = []): LearnState {
  while (s.phase === 'round') s = sort(s, !miss.includes(current(s)!.id))
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
    s = proceed(playPass(s, []))
    expect(s.groupIndex).toBe(1)
    expect(ids(s.group)).toEqual([8, 9, 10, 11, 12, 13, 14])
    s = proceed(playPass(s, []))
    expect(ids(s.group)).toEqual([15])
    s = proceed(playPass(s, []))
    expect(s.phase).toBe('done')
    expect(segments(s)).toEqual([
      { size: 7, done: 7 },
      { size: 7, done: 7 },
      { size: 1, done: 1 },
    ])
  })

  it('a pass with misses continues at once with the missed cards, no debrief', () => {
    let s = start(deck(7), 7)
    s = playPass(s, [2, 3, 5, 6, 7])
    expect(s.phase).toBe('round')
    expect(ids(s.queue)).toEqual([1, 2, 3, 4, 5, 6, 7, 2, 3, 5, 6, 7])
    expect(current(s)?.id).toBe(2)
    expect(s.passes).toHaveLength(2)
    expect(cleared(s)).toEqual([1, 4])
    expect(segments(s)[0]).toEqual({ size: 7, done: 2 })
    s = playPass(s, [3, 6, 7])
    expect(s.phase).toBe('round')
    expect(ids(s.queue).slice(12)).toEqual([3, 6, 7])
    s = playPass(s, [])
    expect(s.phase).toBe('debrief')
    expect(groupSummary(s).map((g) => [g.card.id, g.misses])).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 0],
      [5, 1],
      [6, 2],
      [7, 2],
    ])
    expect(proceed(s).phase).toBe('done')
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
  it('matches the spec example: miss 5 twice, debrief, next group is 8 to 13 plus 5', () => {
    let s = start(deck(13), 7)
    s = playPass(s, [5])
    expect(s.phase).toBe('round')
    expect(isSolo(s)).toBe(true)
    expect(current(s)?.id).toBe(5)
    s = sort(s, false)
    expect(s.phase).toBe('debrief')
    expect(s.carry?.id).toBe(5)
    s = proceed(s)
    expect(s.groupIndex).toBe(1)
    expect(ids(s.group)).toEqual([8, 9, 10, 11, 12, 13, 5])
    expect(ids(s.queue)).toEqual([8, 9, 10, 11, 12, 13, 5])
    expect(isSolo(s)).toBe(false)
    expect(segments(s)).toEqual([
      { size: 7, done: 7 },
      { size: 7, done: 0 },
    ])
  })

  it('a card checked on its solo pass ends the group', () => {
    let s = start(deck(14), 7)
    s = playPass(s, [5])
    s = sort(s, true)
    expect(s.phase).toBe('debrief')
    expect(s.carry).toBeNull()
    s = proceed(s)
    expect(ids(s.group)).toEqual([8, 9, 10, 11, 12, 13, 14])
  })

  it('the carried card follows the same rule in its new group', () => {
    let s = start(deck(14), 7)
    s = proceed(playGroup(s, [5]))
    expect(ids(s.group)).toEqual([8, 9, 10, 11, 12, 13, 5])
    s = playPass(s, [5])
    expect(isSolo(s)).toBe(true)
    s = sort(s, false)
    expect(s.phase).toBe('debrief')
    s = proceed(s)
    expect(ids(s.group)).toEqual([14, 5])
  })

  it('with no cards left, a twice-missed card keeps getting solo passes until checked', () => {
    let s = start(deck(1), 7)
    s = sort(s, false)
    expect(isSolo(s)).toBe(true)
    s = sort(s, false)
    expect(s.phase).toBe('round')
    expect(isSolo(s)).toBe(true)
    expect(ids(s.queue)).toEqual([1, 1, 1])
    s = sort(s, true)
    expect(s.phase).toBe('debrief')
    expect(proceed(s).phase).toBe('done')
  })

  it('a group of one at the end follows the same rules', () => {
    let s = start(deck(8), 7)
    s = proceed(playPass(s, []))
    expect(ids(s.group)).toEqual([8])
    s = sort(s, false)
    expect(isSolo(s)).toBe(true)
    s = sort(s, true)
    expect(s.phase).toBe('debrief')
    expect(proceed(s).phase).toBe('done')
  })

  it('with n 1, a carried card still gets one new card in its next group', () => {
    let s = start(deck(3), 1)
    expect(ids(s.group)).toEqual([1])
    s = proceed(playGroup(s, [1]))
    expect(ids(s.group)).toEqual([2, 1])
    expect(s.groupIndex).toBe(1)
    s = proceed(playGroup(s))
    expect(ids(s.group)).toEqual([3])
    s = proceed(playGroup(s))
    expect(s.phase).toBe('done')
  })
})

describe('undo', () => {
  it('steps back within a pass and from the debrief, and unclears a checked card', () => {
    let s = start(deck(2), 7)
    s = sort(s, true)
    s = sort(s, true)
    expect(s.phase).toBe('debrief')
    s = undo(s)
    expect(s.phase).toBe('round')
    expect(current(s)?.id).toBe(2)
    expect(cleared(s)).toEqual([1])
    s = undo(s)
    expect(current(s)?.id).toBe(1)
    expect(cleared(s)).toEqual([])
    expect(undo(s)).toBe(s)
  })

  it('steps back across a pass boundary and removes the appended pass', () => {
    let s = start(deck(3), 7)
    s = playPass(s, [2, 3])
    expect(ids(s.queue)).toEqual([1, 2, 3, 2, 3])
    expect(current(s)?.id).toBe(2)
    s = undo(s)
    expect(ids(s.queue)).toEqual([1, 2, 3])
    expect(current(s)?.id).toBe(3)
    expect(s.passes).toHaveLength(1)
    // Checking 3 now leaves only 2 missed: a solo pass.
    s = sort(s, true)
    expect(ids(s.queue)).toEqual([1, 2, 3, 2])
    expect(isSolo(s)).toBe(true)
  })

  it('undo from a carry debrief clears the carry', () => {
    let s = start(deck(9), 7)
    s = playGroup(s, [5])
    expect(s.carry?.id).toBe(5)
    s = undo(s)
    expect(s.carry).toBeNull()
    expect(current(s)?.id).toBe(5)
    expect(isSolo(s)).toBe(true)
  })
})

describe('shuffle and restart', () => {
  it('shuffle before the first sort mixes the group with the cards not yet grouped', () => {
    let s = start(deck(14), 7)
    expect(canShuffle(s)).toBe(true)
    s = shuffle(s, () => 0)
    const all = [...ids(s.group), ...ids(s.remaining)].sort((a, b) => a - b)
    expect(all).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(ids(s.group)).not.toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(ids(s.queue)).toEqual(ids(s.group))
    expect(s.group).toHaveLength(7)
  })

  it('shuffle before the first sort keeps a carried card last in its group', () => {
    let s = start(deck(14), 7)
    s = proceed(playGroup(s, [5]))
    s = shuffle(s, () => 0.5)
    expect(s.group[6].id).toBe(5)
    const others = ids(s.group).slice(0, 6)
    expect(others.every((id) => id >= 8 && id <= 14)).toBe(true)
    expect([...others, ...ids(s.remaining)].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14])
  })

  it('shuffle after a sort moves only the unsorted part of the queue and the cards not yet grouped', () => {
    let s = start(deck(14), 7)
    s = sort(s, true)
    s = sort(s, false)
    let n = 0
    const rng = () => [0.9, 0.1, 0.5, 0.3, 0.7][n++ % 5]
    s = shuffle(s, rng)
    expect(ids(s.queue).slice(0, 2)).toEqual([1, 2])
    expect(ids(s.queue).slice(2).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7])
    expect(ids(s.queue).slice(2)).not.toEqual([3, 4, 5, 6, 7])
    expect(ids(s.group)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(s.results).toHaveLength(2)
  })

  it('canShuffle is false in the debrief and when nothing can move', () => {
    let s = start(deck(1), 7)
    expect(canShuffle(s)).toBe(false)
    s = sort(s, true)
    expect(canShuffle(s)).toBe(false)
  })

  it('restart returns to the first group', () => {
    let s = start(deck(14), 7)
    s = proceed(playPass(s, []))
    s = restart(s)
    expect(s.groupIndex).toBe(0)
    expect(ids(s.group)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
