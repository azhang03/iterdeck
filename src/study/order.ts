import type { Card } from '../api.ts'

// The card before this one in the order of the set (the order of the editor),
// or null for the first card. A study session can show the cards in another
// order (a shuffle, a later round, starred only); this does not follow it.
export function previousInSet(cards: Card[], cardId: number): Card | null {
  const ordered = [...cards].sort((a, b) => a.position - b.position)
  const at = ordered.findIndex((c) => c.id === cardId)
  return at > 0 ? ordered[at - 1] : null
}
