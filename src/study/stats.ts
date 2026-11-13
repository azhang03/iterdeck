import type { Card } from '../api.ts'

// Percent of Flashcards sorts that were checked, rounded. Null when never sorted.
// Multiply before dividing so a true .5 rounds up (23 of 40 is 58, not 57).
export function percent(card: Pick<Card, 'checked_count' | 'sorted_count'>): number | null {
  if (card.sorted_count === 0) return null
  return Math.round((card.checked_count * 100) / card.sorted_count)
}

// 0 is red, 100 is green: HSL hue from 0 to 120.
export function percentColor(p: number): string {
  return `hsl(${Math.round((p / 100) * 120)} 70% var(--stat-lightness))`
}

export type CardOrder = 'original' | 'stats-asc' | 'stats-desc'

// Original is editor order. The stats orders put cards with no data last.
export function orderCards(cards: Card[], order: CardOrder): Card[] {
  if (order === 'original') return [...cards].sort((a, b) => a.position - b.position)
  const sign = order === 'stats-asc' ? 1 : -1
  return [...cards].sort((a, b) => {
    const pa = percent(a)
    const pb = percent(b)
    if (pa === null && pb === null) return a.position - b.position
    if (pa === null) return 1
    if (pb === null) return -1
    return pa === pb ? a.position - b.position : sign * (pa - pb)
  })
}
