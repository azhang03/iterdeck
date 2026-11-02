import type { Card, CardInput } from '../api.ts'

// A card as the editor holds it. key is stable across edits and reorders;
// id is set only for cards that exist on the server.
export type EditorCard = {
  key: string
  id?: number
  term: string
  definition: string
  term_image: { id: number; url: string } | null
  definition_image: { id: number; url: string } | null
}

let nextKey = 1

export function blankCard(): EditorCard {
  return { key: `new-${nextKey++}`, term: '', definition: '', term_image: null, definition_image: null }
}

export function fromCards(cards: Card[]): EditorCard[] {
  return cards.map((c) => ({
    key: `card-${c.id}`,
    id: c.id,
    term: c.term,
    definition: c.definition,
    term_image: c.term_image_id !== null && c.term_image_url !== null ? { id: c.term_image_id, url: c.term_image_url } : null,
    definition_image:
      c.definition_image_id !== null && c.definition_image_url !== null
        ? { id: c.definition_image_id, url: c.definition_image_url }
        : null,
  }))
}

export function isEmpty(c: EditorCard): boolean {
  return c.term.trim() === '' && c.definition.trim() === '' && c.term_image === null && c.definition_image === null
}

// The body for PUT /api/sets/:id/cards. Empty cards are dropped.
export function toInputs(cards: EditorCard[]): CardInput[] {
  return cards
    .filter((c) => !isEmpty(c))
    .map((c) => ({
      id: c.id,
      term: c.term,
      definition: c.definition,
      term_image_id: c.term_image?.id ?? null,
      definition_image_id: c.definition_image?.id ?? null,
    }))
}

// Term becomes definition and definition becomes term, text and image, on every card.
export function swapSides(cards: EditorCard[]): EditorCard[] {
  return cards.map((c) => ({
    ...c,
    term: c.definition,
    definition: c.term,
    term_image: c.definition_image,
    definition_image: c.term_image,
  }))
}

// Compares what would be saved, so an empty trailing card does not count as a change.
export function sameContent(a: EditorCard[], b: EditorCard[]): boolean {
  return JSON.stringify(toInputs(a)) === JSON.stringify(toInputs(b))
}
