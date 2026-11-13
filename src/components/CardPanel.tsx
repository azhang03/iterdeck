import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { Language } from '../api.ts'
import type { EditorCard } from '../editor/cards.ts'
import ImageSquare from './ImageSquare.tsx'

type Props = {
  card: EditorCard
  index: number
  // The set's language when code mode is on; null hides the code fields.
  language: Language | null
  focusTerm: boolean
  onChange: (patch: Partial<EditorCard>) => void
  onFocused: () => void
  onDelete: () => void
  isLast: boolean
  onTabOut: () => void
}

const area = 'w-full resize-none rounded border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none'

export default function CardPanel({ card, index, language, focusTerm, isLast, onChange, onFocused, onDelete, onTabOut }: Props) {
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
      className={`rounded-lg border border-line bg-surface p-4 shadow-sm ${isDragging ? 'relative z-10 shadow-lg' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Move card ${index + 1}`}
            className="cursor-grab rounded px-2 py-1 hover:bg-hover active:cursor-grabbing"
          >
            ::
          </button>
          <span>{index + 1}</span>
        </div>
        <button type="button" onClick={onDelete} aria-label={`Delete card ${index + 1}`} className="rounded px-2 py-1 hover:bg-hover">
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
            <span className="mt-1 block text-xs uppercase tracking-wide text-muted">Term</span>
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
            <span className="mt-1 block text-xs uppercase tracking-wide text-muted">Definition</span>
          </label>
        </div>
        <ImageSquare
          image={card.definition_image}
          label={`definition image ${index + 1}`}
          onChange={(definition_image) => onChange({ definition_image })}
        />
      </div>
      {language === 'python' && (
        <label className="mt-3 block">
          <textarea
            value={card.tests}
            onChange={(e) => onChange({ tests: e.target.value })}
            rows={4}
            spellCheck={false}
            placeholder="One case per paragraph. Each case runs after the solution, for example: assert two_sum([2, 7], 9) == [0, 1]"
            aria-label={`Tests ${index + 1}`}
            className={`${area} font-mono`}
          />
          <span className="mt-1 block text-xs uppercase tracking-wide text-muted">Tests</span>
        </label>
      )}
      {language === 'postgresql' && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={card.ordered}
            onChange={(e) => onChange({ ordered: e.target.checked })}
            aria-label={`Rows in order ${index + 1}`}
          />
          Rows must be in order
        </label>
      )}
    </div>
  )
}
