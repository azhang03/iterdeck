import type { Card } from '../api.ts'
import { otherSide, sideText, type Side } from '../study/options.ts'

type Props = { card: Card; front: Side; flipped: boolean; onFlip: () => void }

// The card as a problem description: top-aligned text that scrolls. Click to see the back.
export default function ProblemPanel({ card, front, flipped, onFlip }: Props) {
  const side = flipped ? otherSide(front) : front
  const { text, image } = sideText(card, side)
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label={`Card, showing ${side}. Flip`}
      className="block w-full text-left focus:outline-none"
    >
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
        <span>{side}</span>
        <span>click to flip</span>
      </div>
      {image && <img src={image} alt="" className="mb-4 max-h-64 max-w-full rounded object-contain" />}
      <pre className="font-sans text-base whitespace-pre-wrap">{text || <span className="text-gray-400">(empty)</span>}</pre>
    </button>
  )
}
