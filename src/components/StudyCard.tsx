import type { Card } from '../api.ts'
import { otherSide, sideText, type Side } from '../study/options.ts'
import CardText from './CardText.tsx'

type Props = { card: Card; front: Side; flipped: boolean; onFlip: () => void }

// The card in the middle of a study page. Click or Space flips it.
export default function StudyCard({ card, front, flipped, onFlip }: Props) {
  const side = flipped ? otherSide(front) : front
  const { text, image } = sideText(card, side)
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label={`Card, showing ${side}. Flip`}
      className={`flex min-h-72 w-full flex-col items-center justify-center gap-4 rounded-card border border-line p-8 text-center shadow-card hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${flipped ? 'bg-surface-back' : 'bg-surface'}`}
    >
      {image && <img src={image} alt="" className="max-h-48 max-w-full rounded object-contain" />}
      <CardText text={text} className="card-text-centered w-full min-w-0 text-2xl" />
      <span className={`text-xs uppercase tracking-wide ${flipped ? 'text-accent' : 'text-muted'}`}>{side}</span>
    </button>
  )
}
