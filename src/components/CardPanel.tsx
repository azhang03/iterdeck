import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { EditorCard } from '../editor/cards.ts'

type Props = {
  card: EditorCard
  index: number
  focusTerm: boolean
  onChange: (patch: Partial<EditorCard>) => void
  onFocused: () => void
  onDelete: () => void
  onTabOut: () => void
}

const area = 'w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'

export default function CardPanel({ card, index, focusTerm, onChange, onFocused, onDelete, onTabOut }: Props) {
  const termRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!focusTerm) return
    termRef.current?.focus()
    onFocused()
  }, [focusTerm, onFocused])

  function onDefinitionKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      onTabOut()
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>{index + 1}</span>
        <button type="button" onClick={onDelete} aria-label={`Delete card ${index + 1}`} className="rounded px-2 py-1 hover:bg-gray-100">
          Delete
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <textarea
            ref={termRef}
            value={card.term}
            onChange={(e) => onChange({ term: e.target.value })}
            rows={2}
            placeholder="Term"
            aria-label={`Term ${index + 1}`}
            className={area}
          />
          <span className="mt-1 block text-xs uppercase tracking-wide text-gray-500">Term</span>
        </label>
        <label className="block">
          <textarea
            value={card.definition}
            onChange={(e) => onChange({ definition: e.target.value })}
            onKeyDown={onDefinitionKey}
            rows={2}
            placeholder="Definition"
            aria-label={`Definition ${index + 1}`}
            className={area}
          />
          <span className="mt-1 block text-xs uppercase tracking-wide text-gray-500">Definition</span>
        </label>
      </div>
    </div>
  )
}
