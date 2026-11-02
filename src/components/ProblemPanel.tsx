import type { Card } from '../api.ts'
import { otherSide, sideText, type Side } from '../study/options.ts'

type Props = { card: Card; front: Side; flipped: boolean; onFlip: () => void }

// The card as a problem description: top-aligned text that scrolls. Click anywhere
// in the panel to see the back. Buttons may hold only phrasing content, so the
// parts are spans.
export default function ProblemPanel({ card, front, flipped, onFlip }: Props) {
  const side = flipped ? otherSide(front) : front
  const { text, image } = sideText(card, side)
  return (
    <button type="button" onClick={onFlip} aria-label={`Card, showing ${side}. Flip`} className="block min-h-full w-full text-left focus:outline-none">
      <span className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
        <span>{side}</span>
        <span>click to flip</span>
      </span>
      {image && <img src={image} alt="" className="mb-4 max-h-64 max-w-full rounded object-contain" />}
      <span className="block font-sans text-base whitespace-pre-wrap select-text">{text || <span className="text-gray-400">(empty)</span>}</span>
    </button>
  )
}
