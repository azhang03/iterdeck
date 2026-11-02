import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { EditorCard } from '../editor/cards.ts'
import ImageSquare from './ImageSquare.tsx'

type Props = {
  card: EditorCard
  index: number
  focusTerm: boolean
  onChange: (patch: Partial<EditorCard>) => void
  onFocused: () => void
  onDelete: () => void
  isLast: boolean
  onTabOut: () => void
}

const area = 'w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'

export default function CardPanel({ card, index, focusTerm, isLast, onChange, onFocused, onDelete, onTabOut }: Props) {
  const termRef = useRef<HTMLTextAreaElement>(null)
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: card.key })

  useEffect(() => {
    if (!focusTerm) return
    termRef.current?.focus()
    onFocused()
  }, [focusTerm, onFocused])

  // Tab out of the last definition adds a card. Elsewhere Tab keeps the browser default.
  function onDefinitionKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (isLast && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      onTabOut()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${isDragging ? 'relative z-10 shadow-lg' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Move card ${index + 1}`}
            className="cursor-grab rounded px-2 py-1 hover:bg-gray-100 active:cursor-grabbing"
          >
            ::
          </button>
          <span>{index + 1}</span>
        </div>
        <button type="button" onClick={onDelete} aria-label={`Delete card ${index + 1}`} className="rounded px-2 py-1 hover:bg-gray-100">
          Delete
        </button>
      </div>
      <div className="flex items-start gap-4">
        <ImageSquare image={card.term_image} label={`term image ${index + 1}`} onChange={(term_image) => onChange({ term_image })} />
        <div className="grid flex-1 grid-cols-2 gap-4">
          <label className="block">
            <textarea
              ref={termRef}
              value={card.term}
              onChange={(e) => onChange({ term: e.target.value })}
              rows={3}
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
              rows={3}
              placeholder="Definition"
              aria-label={`Definition ${index + 1}`}
              className={area}
            />
            <span className="mt-1 block text-xs uppercase tracking-wide text-gray-500">Definition</span>
          </label>
        </div>
        <ImageSquare
          image={card.definition_image}
          label={`definition image ${index + 1}`}
          onChange={(definition_image) => onChange({ definition_image })}
        />
      </div>
    </div>
  )
}
