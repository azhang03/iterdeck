import { describe, expect, it } from 'vitest'
import type { Card } from '../api.ts'
import { current, done, flip, missed, nextRound, restart, roundOver, shuffle, sort, start, summary, undo } from './flashcards.ts'

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

const deck = [1, 2, 3, 4, 5, 6, 7].map(card)
const ids = (cards: Card[]) => cards.map((c) => c.id)

describe('sort and flip', () => {
  it('sort advances and clears the flip; flip toggles', () => {
    let s = start(deck)
    expect(current(s)?.id).toBe(1)
    s = flip(s)
    expect(s.flipped).toBe(true)
    s = sort(s, true)
    expect(current(s)?.id).toBe(2)
    expect(s.flipped).toBe(false)
    expect(s.results).toEqual([{ cardId: 1, checked: true }])
  })

  it('does nothing after the round is over', () => {
    let s = start(deck.slice(0, 1))
    s = sort(s, false)
    expect(roundOver(s)).toBe(true)
    expect(sort(s, true)).toBe(s)
    expect(flip(s)).toBe(s)
  })
})

describe('undo', () => {
  it('restores the card and returns the undone result', () => {
    let s = start(deck)
    s = sort(s, true)
    s = sort(s, false)
    const { state, undone } = undo(s)
    expect(undone).toEqual({ cardId: 2, checked: false })
    expect(current(state)?.id).toBe(2)
    expect(state.results).toHaveLength(1)
    expect(undo(start(deck)).undone).toBeNull()
  })

  it('works after the last card, bringing the round back', () => {
    let s = start(deck.slice(0, 2))
    s = sort(s, true)
    s = sort(s, true)
    expect(roundOver(s)).toBe(true)
    const { state } = undo(s)
    expect(roundOver(state)).toBe(false)
    expect(current(state)?.id).toBe(2)
  })
})

describe('rounds', () => {
  it('a round with 2 misses out of 7 continues with those 2 in order', () => {
    let s = start(deck)
    const checks = [true, false, true, true, false, true, true]
    for (const c of checks) s = sort(s, c)
    expect(roundOver(s)).toBe(true)
    expect(summary(s)).toEqual({ checked: 5, missed: 2, total: 7, percent: 71 })
    expect(ids(missed(s))).toEqual([2, 5])
    expect(done(s)).toBe(false)
    s = nextRound(s)
    expect(s.round).toBe(2)
    expect(ids(s.queue)).toEqual([2, 5])
    expect(s.results).toEqual([])
    expect(current(s)?.id).toBe(2)
  })

  it('reaches done when a round has no misses, and nextRound then does nothing', () => {
    let s = start(deck.slice(0, 2))
    s = sort(s, true)
    s = sort(s, true)
    expect(done(s)).toBe(true)
    expect(nextRound(s)).toBe(s)
  })

  it('nextRound before the round ends does nothing', () => {
    const s = sort(start(deck), false)
    expect(nextRound(s)).toBe(s)
  })

  it('restart returns to the full deck in original order', () => {
    let s = start(deck)
    s = shuffle(s, () => 0)
    s = sort(s, false)
    s = nextRound(sort(sort(sort(sort(sort(sort(s, true), true), true), true), true), true))
    s = restart(s)
    expect(ids(s.queue)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(s.round).toBe(1)
    expect(s.results).toEqual([])
  })
})

describe('shuffle', () => {
  it('keeps the sorted cards in place and the same set of remaining cards', () => {
    let s = start(deck)
    s = sort(s, true)
    s = sort(s, false)
    let n = 0
    const rng = () => [0.9, 0.1, 0.5, 0.3, 0.7][n++ % 5]
    const shuffled = shuffle(s, rng)
    expect(ids(shuffled.queue.slice(0, 2))).toEqual([1, 2])
    expect(ids(shuffled.queue.slice(2)).sort()).toEqual([3, 4, 5, 6, 7])
    expect(ids(shuffled.queue.slice(2))).not.toEqual([3, 4, 5, 6, 7])
    expect(shuffled.results).toEqual(s.results)
    expect(current(shuffled)?.id).toBe(shuffled.queue[2].id)
  })
})
