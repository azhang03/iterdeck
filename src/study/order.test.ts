import { describe, expect, it } from 'vitest'
import type { Card } from '../api.ts'
import { previousInSet } from './order.ts'

function card(id: number, position: number): Card {
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
    checked_count: 0,
    sorted_count: 0,
    tests: '',
    ordered: 0,
    code: '',
    note: '',
    created_at: '',
  }
}

describe('previousInSet', () => {
  // Ids do not follow the positions, and the list is not in position order.
  const cards = [card(30, 2), card(10, 0), card(20, 1)]

  it('gives the card one position before, whatever the order of the list', () => {
    expect(previousInSet(cards, 30)?.id).toBe(20)
    expect(previousInSet(cards, 20)?.id).toBe(10)
  })

  it('gives null for the first card and for a card that is not in the set', () => {
    expect(previousInSet(cards, 10)).toBeNull()
    expect(previousInSet(cards, 99)).toBeNull()
  })
})
