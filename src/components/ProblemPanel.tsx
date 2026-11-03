import type { Card } from '../api.ts'
import { otherSide, sideText, type Side } from '../study/options.ts'
import CardText from './CardText.tsx'

type Props = { card: Card; front: Side; flipped: boolean; onFlip: () => void }

// The card as a problem description: top-aligned text that scrolls. Click anywhere
// in the panel to see the back. The text can be selected and copied. A button
// centers its content; flex-col keeps it at the top.
export default function ProblemPanel({ card, front, flipped, onFlip }: Props) {
  const side = flipped ? otherSide(front) : front
  const { text, image } = sideText(card, side)
  return (
    <button type="button" onClick={onFlip} aria-label={`Card, showing ${side}. Flip`} className="flex min-h-full w-full flex-col items-start text-left focus:outline-none">
      <span className="mb-3 flex w-full items-center justify-between text-xs uppercase tracking-wide text-gray-400">
        <span>{side}</span>
        <span>click to flip</span>
      </span>
      {image && <img src={image} alt="" className="mb-4 max-h-64 max-w-full rounded object-contain" />}
      <CardText text={text} className="w-full font-sans text-base select-text" />
    </button>
  )
}
