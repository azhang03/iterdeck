import type { Card } from '../api.ts'

export type Side = 'term' | 'definition'

// Options shared by Flashcards and Learn. They live in page state and reset on reload.
export type StudyOptions = {
  front: Side
  starredOnly: boolean
  groupSize: number // Learn only
}

export const DEFAULT_OPTIONS: StudyOptions = { front: 'term', starredOnly: false, groupSize: 7 }

export function deckFor(cards: Card[], options: StudyOptions): Card[] {
  const ordered = [...cards].sort((a, b) => a.position - b.position)
  return options.starredOnly ? ordered.filter((c) => c.starred === 1) : ordered
}

export function sideText(card: Card, side: Side): { text: string; image: string | null } {
  return side === 'term'
    ? { text: card.term, image: card.term_image_url }
    : { text: card.definition, image: card.definition_image_url }
}

export function otherSide(side: Side): Side {
  return side === 'term' ? 'definition' : 'term'
}
