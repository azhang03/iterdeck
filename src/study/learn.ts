import type { Card } from '../api.ts'
import type { Result } from './flashcards.ts'

// Learn mode: the deck is split into groups of n. A group loops over its missed
// cards until every card is checked. One-card rule: when a round ends with one
// missed card, that card gets one solo round; missed again, it moves to the end
// of the next group, which takes n - 1 new cards. Pure functions; the page
// renders the state. Learn does not update the stats.

export type Phase = 'round' | 'debrief' | 'done'

export type LearnState = {
  deck: Card[]
  n: number
  remaining: Card[] // cards not yet placed in a group
  group: Card[] // the current group
  groupIndex: number // 0-based
  cleared: number[] // ids checked in this group so far
  finishedGroups: number[] // sizes of the completed groups
  queue: Card[] // this round
  index: number
  flipped: boolean
  results: Result[]
  roundInGroup: number // 1 for the first round of a group
  solo: boolean // this round is the one-card second chance
  carry: Card | null // a card that goes to the end of the next group
  carried: number | null // id of the card carried into the current group, if any
  phase: Phase
}

export function start(deck: Card[], n: number): LearnState {
  const size = Math.max(1, Math.floor(n))
  const base: LearnState = {
    deck,
    n: size,
    remaining: deck,
    group: [],
    groupIndex: -1,
    cleared: [],
    finishedGroups: [],
    queue: [],
    index: 0,
    flipped: false,
    results: [],
    roundInGroup: 0,
    solo: false,
    carry: null,
    carried: null,
    phase: 'done',
  }
  return deck.length === 0 ? base : nextGroup(base)
}

export function current(s: LearnState): Card | null {
  return s.phase === 'round' ? (s.queue[s.index] ?? null) : null
}

export function flip(s: LearnState): LearnState {
  return s.phase === 'round' ? { ...s, flipped: !s.flipped } : s
}

// Records the result. The last card of the round moves to the debrief.
export function sort(s: LearnState, checked: boolean): LearnState {
  const card = current(s)
  if (!card) return s
  const results = [...s.results, { cardId: card.id, checked }]
  const cleared = checked ? [...s.cleared, card.id] : s.cleared
  const index = s.index + 1
  return { ...s, index, flipped: false, results, cleared, phase: index >= s.queue.length ? 'debrief' : 'round' }
}

// Goes back one card within the round, also from the debrief.
export function undo(s: LearnState): LearnState {
  if (s.results.length === 0 || s.phase === 'done') return s
  const last = s.results[s.results.length - 1]
  return {
    ...s,
    index: s.index - 1,
    flipped: false,
    results: s.results.slice(0, -1),
    cleared: last.checked ? s.cleared.filter((id) => id !== last.cardId) : s.cleared,
    phase: 'round',
  }
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Shuffles what is still to come. Before the first sort of a group, the group and the
// cards not yet grouped mix together (a carried card stays last in the group). Later,
// the unsorted part of the round and the cards not yet grouped shuffle separately.
export function shuffle(s: LearnState, rng: () => number = Math.random): LearnState {
  if (s.phase !== 'round') return s
  if (s.roundInGroup === 1 && s.results.length === 0) {
    const carried = s.group.find((c) => c.id === s.carried) ?? null
    const pool = shuffled([...s.group.filter((c) => c !== carried), ...s.remaining], rng)
    const size = s.group.length - (carried ? 1 : 0)
    const group = carried ? [...pool.slice(0, size), carried] : pool.slice(0, size)
    return { ...s, group, queue: group, remaining: pool.slice(size), flipped: false }
  }
  const queue = [...s.queue.slice(0, s.index), ...shuffled(s.queue.slice(s.index), rng)]
  return { ...s, queue, remaining: shuffled(s.remaining, rng), flipped: false }
}

// True when shuffle would change anything.
export function canShuffle(s: LearnState): boolean {
  if (s.phase !== 'round') return false
  if (s.roundInGroup === 1 && s.results.length === 0) return s.group.length + s.remaining.length > 1
  return s.queue.length - s.index > 1 || s.remaining.length > 1
}

export function missed(s: LearnState): Card[] {
  const byId = new Map(s.queue.map((c) => [c.id, c]))
  return s.results.filter((r) => !r.checked).map((r) => byId.get(r.cardId)!)
}

export function roundSummary(s: LearnState): { checked: Card[]; missed: Card[] } {
  const byId = new Map(s.queue.map((c) => [c.id, c]))
  return {
    checked: s.results.filter((r) => r.checked).map((r) => byId.get(r.cardId)!),
    missed: missed(s),
  }
}

// From the debrief: the next round of this group, or the next group, or done.
export function proceed(s: LearnState): LearnState {
  if (s.phase !== 'debrief') return s
  const miss = missed(s)
  if (miss.length === 0) return nextGroup({ ...s, finishedGroups: [...s.finishedGroups, s.group.length] })
  if (miss.length === 1) {
    const card = miss[0]
    if (!s.solo) return round(s, [card], true)
    // Missed the second chance. Carry it to the next group; with no cards left, keep trying it alone.
    if (s.remaining.length === 0) return round(s, [card], true)
    return nextGroup({ ...s, carry: card, finishedGroups: [...s.finishedGroups, s.group.length] })
  }
  return round(s, miss, false)
}

function round(s: LearnState, queue: Card[], solo: boolean): LearnState {
  return { ...s, queue, index: 0, flipped: false, results: [], roundInGroup: s.roundInGroup + 1, solo, phase: 'round' }
}

function nextGroup(s: LearnState): LearnState {
  // A carried card takes one place of the next group, but the group always gets at least one new card.
  const take = s.carry ? Math.max(1, s.n - 1) : s.n
  const fresh = s.remaining.slice(0, take)
  const group = s.carry ? [...fresh, s.carry] : fresh
  if (group.length === 0) return { ...s, group: [], queue: [], results: [], cleared: [], carry: null, phase: 'done' }
  return round(
    {
      ...s,
      remaining: s.remaining.slice(take),
      group,
      groupIndex: s.groupIndex + 1,
      cleared: [],
      roundInGroup: 0,
      carry: null,
      carried: s.carry?.id ?? null,
    },
    group,
    false,
  )
}

export function restart(s: LearnState): LearnState {
  return start(s.deck, s.n)
}

// Progress: one segment per group. Finished groups are full; the current group counts
// its cleared cards; the cards not yet grouped are shown as groups of n.
export function segments(s: LearnState): { size: number; done: number }[] {
  const out = s.finishedGroups.map((size) => ({ size, done: size }))
  if (s.group.length) out.push({ size: s.group.length, done: s.cleared.length })
  const rest = s.remaining.length + (s.carry ? 1 : 0)
  for (let left = rest; left > 0; left -= s.n) out.push({ size: Math.min(s.n, left), done: 0 })
  return out
}
