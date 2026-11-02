import { describe, expect, it } from 'vitest'
import { blankCard, sameContent, swapSides, toInputs, type EditorCard } from './cards.ts'

const img = (id: number) => ({ id, url: `/images/${id}.png` })

function card(over: Partial<EditorCard>): EditorCard {
  return { ...blankCard(), ...over }
}

describe('toInputs', () => {
  it('drops cards with no text and no images, keeps ids, and strips the rest', () => {
    const cards = [
      card({ id: 7, term: 'a', definition: '' }),
      card({ term: '  ', definition: '' }),
      card({ term: '', definition: '', term_image: img(3) }),
      card({ term: '', definition: 'd' }),
    ]
    expect(toInputs(cards)).toEqual([
      { id: 7, term: 'a', definition: '', term_image_id: null, definition_image_id: null },
      { id: undefined, term: '', definition: '', term_image_id: 3, definition_image_id: null },
      { id: undefined, term: '', definition: 'd', term_image_id: null, definition_image_id: null },
    ])
  })
})

describe('swapSides', () => {
  it('swaps text and images on every card and keeps keys and ids', () => {
    const [a] = swapSides([card({ key: 'k', id: 1, term: 't', definition: 'd', term_image: img(1), definition_image: null })])
    expect(a).toMatchObject({ key: 'k', id: 1, term: 'd', definition: 't', term_image: null, definition_image: img(1) })
  })
})

describe('sameContent', () => {
  it('ignores empty cards and key differences', () => {
    const saved = [card({ key: 'x', id: 1, term: 'a', definition: 'b' })]
    const edited = [card({ key: 'y', id: 1, term: 'a', definition: 'b' }), blankCard()]
    expect(sameContent(saved, edited)).toBe(true)
    expect(sameContent(saved, [card({ id: 1, term: 'a', definition: 'c' })])).toBe(false)
    expect(sameContent(saved, [])).toBe(false)
  })
})
