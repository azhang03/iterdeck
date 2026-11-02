import { useState } from 'react'
import { api, type Card } from '../api.ts'
import { percentColor } from '../study/stats.ts'

type Props = { card: Card; onChange: (card: Card) => void; stat?: { percent: number | null } }

const area = 'w-full resize-none rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'

// One card on the set page: term and definition side by side, a star, and an
// edit button that turns the texts into text areas in place.
export default function CardRow({ card, onChange, stat }: Props) {
  const [editing, setEditing] = useState(false)
  const [term, setTerm] = useState(card.term)
  const [definition, setDefinition] = useState(card.definition)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(patch: { term?: string; definition?: string; starred?: boolean }) {
    setBusy(true)
    setError(null)
    try {
      onChange(await api.cards.update(card.id, patch))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  function startEdit() {
    setTerm(card.term)
    setDefinition(card.definition)
    setEditing(true)
  }

  async function saveEdit() {
    if (await run({ term, definition })) setEditing(false)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <Side text={card.term} image={card.term_image_url} editing={editing} value={term} onValue={setTerm} label={`Term ${card.position + 1}`} />
        <div className="w-px self-stretch bg-gray-200" />
        <Side
          text={card.definition}
          image={card.definition_image_url}
          editing={editing}
          value={definition}
          onValue={setDefinition}
          label={`Definition ${card.position + 1}`}
        />
        <div className="flex w-28 shrink-0 flex-col items-end gap-1">
          {stat && (
            <span className="text-sm font-medium" style={stat.percent === null ? undefined : { color: percentColor(stat.percent) }}>
              {stat.percent === null ? <span className="text-gray-400">no data</span> : `${stat.percent}%`}
            </span>
          )}
          <button
            type="button"
            onClick={() => void run({ starred: !card.starred })}
            disabled={busy}
            aria-label={card.starred ? `Unstar card ${card.position + 1}` : `Star card ${card.position + 1}`}
            aria-pressed={card.starred === 1}
            className={`rounded px-2 py-1 text-lg leading-none ${card.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-gray-500'}`}
          >
            {card.starred ? '\u2605' : '\u2606'}
          </button>
          {editing ? (
            <div className="flex gap-1">
              <button type="button" onClick={() => setEditing(false)} disabled={busy} className="rounded px-2 py-1 text-xs hover:bg-gray-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={busy}
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEdit} aria-label={`Edit card ${card.position + 1}`} className="rounded px-2 py-1 text-xs hover:bg-gray-100">
              Edit
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

type SideProps = { text: string; image: string | null; editing: boolean; value: string; onValue: (v: string) => void; label: string }

function Side({ text, image, editing, value, onValue, label }: SideProps) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      {image && <img src={image} alt="" className="h-16 w-16 shrink-0 rounded border border-gray-200 object-cover" />}
      {editing ? (
        <textarea value={value} onChange={(e) => onValue(e.target.value)} rows={3} aria-label={label} className={area} />
      ) : (
        <p className="whitespace-pre-wrap text-sm">{text || <span className="text-gray-400">(empty)</span>}</p>
      )}
    </div>
  )
}
