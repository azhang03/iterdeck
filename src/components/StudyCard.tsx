import type { Card } from '../api.ts'
import { otherSide, sideText, type Side } from '../study/options.ts'

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
      className="flex min-h-72 w-full flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm hover:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      {image && <img src={image} alt="" className="max-h-48 max-w-full rounded object-contain" />}
      <span className="text-2xl whitespace-pre-wrap">{text || <span className="text-gray-400">(empty)</span>}</span>
      <span className="text-xs uppercase tracking-wide text-gray-400">{side}</span>
    </button>
  )
}
