import type { Card } from '../api.ts'
import type { Result } from './flashcards.ts'

// Learn mode: the deck is split into groups of n. A group is one growing queue:
// when a pass over the queue ends, the cards missed in that pass are appended and
// the next pass starts at once, with no checkpoint. The debrief appears only when
// the group is done (a pass with no misses) or when a card misses its solo second
// chance and is carried to the next group. One-card rule: when a pass ends with
// one missed card, that card gets one solo pass; missed again, it moves to the end
// of the next group, which takes n - 1 new cards. Pure functions; the page renders
// the state. Learn does not update the stats.

export type Phase = 'round' | 'debrief' | 'done'

export type Pass = { start: number; solo: boolean }

export type LearnState = {
  deck: Card[]
  n: number
  remaining: Card[] // cards not yet placed in a group
  group: Card[] // the current group
  groupIndex: number // 0-based
  finishedGroups: number[] // sizes of the completed groups
  queue: Card[] // every card shown in this group, in order; a pass appends its missed cards
  index: number
  flipped: boolean
  results: Result[] // one per card shown, in queue order
  passes: Pass[] // where each pass starts in the queue; the first starts at 0
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
    finishedGroups: [],
    queue: [],
    index: 0,
    flipped: false,
    results: [],
    passes: [],
    carry: null,
    carried: null,
    phase: 'done',
  }
  return deck.length === 0 ? base : nextGroup(base)
}

export function current(s: LearnState): Card | null {
  return s.phase === 'round' ? (s.queue[s.index] ?? null) : null
}

export function currentPass(s: LearnState): Pass {
  return s.passes[s.passes.length - 1] ?? { start: 0, solo: false }
}

// True while the card on screen is the one-card second chance.
export function isSolo(s: LearnState): boolean {
  return s.phase === 'round' && currentPass(s).solo
}

// Ids checked at least once in this group. A checked card does not come back in the group.
export function cleared(s: LearnState): number[] {
  return [...new Set(s.results.filter((r) => r.checked).map((r) => r.cardId))]
}

export function flip(s: LearnState): LearnState {
  return s.phase === 'round' ? { ...s, flipped: !s.flipped } : s
}

// The cards missed in the latest pass, in the order they were seen.
function passMissed(s: LearnState): Card[] {
  const byId = new Map(s.queue.map((c) => [c.id, c]))
  return s.results
    .slice(currentPass(s).start)
    .filter((r) => !r.checked)
    .map((r) => byId.get(r.cardId)!)
}

// Records the result. When the pass ends: no misses, the group is done (debrief);
// one miss, a solo pass, or the debrief with a carry if the solo pass was missed;
// more misses, the next pass over them starts at once.
export function sort(s: LearnState, checked: boolean): LearnState {
  const card = current(s)
  if (!card) return s
  const next: LearnState = { ...s, index: s.index + 1, flipped: false, results: [...s.results, { cardId: card.id, checked }] }
  if (next.index < next.queue.length) return next
  const miss = passMissed(next)
  if (miss.length === 0) return { ...next, phase: 'debrief' }
  if (miss.length === 1 && currentPass(next).solo && next.remaining.length > 0) return { ...next, phase: 'debrief', carry: miss[0] }
  return appendPass(next, miss, miss.length === 1)
}

function appendPass(s: LearnState, cards: Card[], solo: boolean): LearnState {
  return { ...s, queue: [...s.queue, ...cards], passes: [...s.passes, { start: s.queue.length, solo }], phase: 'round' }
}

// Goes back one card, also from the debrief and across a pass boundary.
export function undo(s: LearnState): LearnState {
  if (s.results.length === 0 || s.phase === 'done') return s
  let queue = s.queue
  let passes = s.passes
  const last = currentPass(s)
  if (s.index === last.start && passes.length > 1) {
    // Stepping back over the start of an appended pass removes that pass again.
    queue = queue.slice(0, last.start)
    passes = passes.slice(0, -1)
  }
  return { ...s, queue, passes, index: s.index - 1, flipped: false, results: s.results.slice(0, -1), carry: null, phase: 'round' }
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
// the unsorted part of the queue and the cards not yet grouped shuffle separately.
export function shuffle(s: LearnState, rng: () => number = Math.random): LearnState {
  if (s.phase !== 'round') return s
  if (s.results.length === 0) {
    const carriedCard = s.group.find((c) => c.id === s.carried) ?? null
    const pool = shuffled([...s.group.filter((c) => c !== carriedCard), ...s.remaining], rng)
    const size = s.group.length - (carriedCard ? 1 : 0)
    const group = carriedCard ? [...pool.slice(0, size), carriedCard] : pool.slice(0, size)
    return { ...s, group, queue: group, remaining: pool.slice(size), flipped: false }
  }
  const queue = [...s.queue.slice(0, s.index), ...shuffled(s.queue.slice(s.index), rng)]
  return { ...s, queue, remaining: shuffled(s.remaining, rng), flipped: false }
}

// True when shuffle would change anything.
export function canShuffle(s: LearnState): boolean {
  if (s.phase !== 'round') return false
  if (s.results.length === 0) return s.group.length + s.remaining.length > 1
  return s.queue.length - s.index > 1 || s.remaining.length > 1
}

// For the debrief: each card of the group with how many times it was missed.
export function groupSummary(s: LearnState): { card: Card; misses: number }[] {
  const misses = new Map<number, number>()
  for (const r of s.results) if (!r.checked) misses.set(r.cardId, (misses.get(r.cardId) ?? 0) + 1)
  return s.group.map((card) => ({ card, misses: misses.get(card.id) ?? 0 }))
}

// From the debrief: the next group (with the carried card, if any), or done.
export function proceed(s: LearnState): LearnState {
  if (s.phase !== 'debrief') return s
  return nextGroup({ ...s, finishedGroups: [...s.finishedGroups, s.group.length] })
}

function nextGroup(s: LearnState): LearnState {
  // A carried card takes one place of the next group, but the group always gets at least one new card.
  const take = s.carry ? Math.max(1, s.n - 1) : s.n
  const fresh = s.remaining.slice(0, take)
  const group = s.carry ? [...fresh, s.carry] : fresh
  if (group.length === 0) return { ...s, group: [], queue: [], results: [], passes: [], carry: null, phase: 'done' }
  return {
    ...s,
    remaining: s.remaining.slice(take),
    group,
    groupIndex: s.groupIndex + 1,
    queue: group,
    index: 0,
    flipped: false,
    results: [],
    passes: [{ start: 0, solo: false }],
    carry: null,
    carried: s.carry?.id ?? null,
    phase: 'round',
  }
}

export function restart(s: LearnState): LearnState {
  return start(s.deck, s.n)
}

// Progress: one segment per group. Finished groups are full; the current group counts
// its cleared cards; the cards not yet grouped are shown as groups of n.
export function segments(s: LearnState): { size: number; done: number }[] {
  const out = s.finishedGroups.map((size) => ({ size, done: size }))
  if (s.group.length) out.push({ size: s.group.length, done: cleared(s).length })
  const rest = s.remaining.length + (s.carry ? 1 : 0)
  for (let left = rest; left > 0; left -= s.n) out.push({ size: Math.min(s.n, left), done: 0 })
  return out
}
