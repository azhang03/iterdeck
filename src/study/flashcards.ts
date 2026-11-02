import type { Card } from '../api.ts'

// Flashcards mode: one pass over a queue, then rounds over the missed cards
// until none are missed. Pure functions over a state object; the page renders
// the state and calls the API on the side.

export type Result = { cardId: number; checked: boolean }

export type FlashcardsState = {
  deck: Card[] // the cards in play for this session, in their original order
  queue: Card[] // the cards of the current round, in the order they appear
  index: number // position in the queue; equal to queue.length when the round is over
  flipped: boolean
  results: Result[] // one per sorted card of this round, in order
  round: number // 1 for the first pass
}

export type Rng = () => number

export function start(deck: Card[]): FlashcardsState {
  return { deck, queue: deck, index: 0, flipped: false, results: [], round: 1 }
}

export function current(s: FlashcardsState): Card | null {
  return s.queue[s.index] ?? null
}

export function roundOver(s: FlashcardsState): boolean {
  return s.index >= s.queue.length
}

export function flip(s: FlashcardsState): FlashcardsState {
  if (roundOver(s)) return s
  return { ...s, flipped: !s.flipped }
}

export function sort(s: FlashcardsState, checked: boolean): FlashcardsState {
  const card = current(s)
  if (!card) return s
  return { ...s, index: s.index + 1, flipped: false, results: [...s.results, { cardId: card.id, checked }] }
}

// Goes back one card. Returns the result that was undone, so the page can reverse the stats update.
export function undo(s: FlashcardsState): { state: FlashcardsState; undone: Result | null } {
  if (s.results.length === 0) return { state: s, undone: null }
  const undone = s.results[s.results.length - 1]
  return { state: { ...s, index: s.index - 1, flipped: false, results: s.results.slice(0, -1) }, undone }
}

// Shuffles the cards not yet sorted in this round. Sorted cards keep their place, so undo stays consistent.
export function shuffle(s: FlashcardsState, rng: Rng = Math.random): FlashcardsState {
  const done = s.queue.slice(0, s.index)
  const rest = s.queue.slice(s.index)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return { ...s, queue: [...done, ...rest], flipped: false }
}

export function missed(s: FlashcardsState): Card[] {
  const byId = new Map(s.queue.map((c) => [c.id, c]))
  return s.results.filter((r) => !r.checked).map((r) => byId.get(r.cardId)!)
}

export function summary(s: FlashcardsState): { checked: number; missed: number; total: number; percent: number } {
  const checked = s.results.filter((r) => r.checked).length
  const total = s.results.length
  return { checked, missed: total - checked, total, percent: total === 0 ? 0 : Math.round((checked * 100) / total) }
}

// True when a round ended with every card checked.
export function done(s: FlashcardsState): boolean {
  return roundOver(s) && s.results.every((r) => r.checked)
}

// The next round holds the missed cards of this round, in the order they were seen.
export function nextRound(s: FlashcardsState): FlashcardsState {
  if (!roundOver(s) || done(s)) return s
  return { ...s, queue: missed(s), index: 0, flipped: false, results: [], round: s.round + 1 }
}

export function restart(s: FlashcardsState): FlashcardsState {
  return start(s.deck)
}
