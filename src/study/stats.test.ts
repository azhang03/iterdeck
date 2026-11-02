import { describe, expect, it } from 'vitest'
import type { Card } from '../api.ts'
import { orderCards, percent } from './stats.ts'

function card(id: number, position: number, checked: number, sorted: number): Card {
  return {
    id,
    set_id: 1,
    position,
    term: '',
    definition: '',
    term_image_id: null,
    definition_image_id: null,
    term_image_url: null,
    definition_image_url: null,
    starred: 0,
    checked_count: checked,
    sorted_count: sorted,
    created_at: '',
  }
}

describe('percent', () => {
  it('rounds the checked share and is null with no sorts', () => {
    expect(percent({ checked_count: 3, sorted_count: 4 })).toBe(75)
    expect(percent({ checked_count: 1, sorted_count: 3 })).toBe(33)
    expect(percent({ checked_count: 2, sorted_count: 3 })).toBe(67)
    expect(percent({ checked_count: 23, sorted_count: 40 })).toBe(58)
    expect(percent({ checked_count: 29, sorted_count: 200 })).toBe(15)
    expect(percent({ checked_count: 0, sorted_count: 0 })).toBeNull()
  })
})

describe('orderCards', () => {
  const cards = [card(1, 0, 1, 2), card(2, 1, 0, 0), card(3, 2, 0, 4), card(4, 3, 4, 4), card(5, 4, 2, 4)]

  it('original follows position', () => {
    expect(orderCards([...cards].reverse(), 'original').map((c) => c.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('low to high puts no-data cards last and ties in position order', () => {
    expect(orderCards(cards, 'stats-asc').map((c) => c.id)).toEqual([3, 1, 5, 4, 2])
  })

  it('high to low also puts no-data cards last', () => {
    expect(orderCards(cards, 'stats-desc').map((c) => c.id)).toEqual([4, 1, 5, 3, 2])
  })
})
