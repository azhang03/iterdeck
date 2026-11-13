import { useEffect, useRef, useState } from 'react'

type Props = {
  note: string
  // Saves the note. An empty text removes it.
  onSave: (note: string) => void
}

// The limit of the server for a note.
const MAX_LENGTH = 2000

// The user's note to self about a card, under the card in a study mode. With a
// note it shows as a strip, so the user sees it when the card comes up again.
// With none it is one quiet button. Give it the card id as its key.
export default function CardNote({ note, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note)
  const field = useRef<HTMLTextAreaElement>(null)

  // An edit that is still open when the card leaves the screen is saved, not lost.
  const open = useRef<string | null>(null)
  useEffect(() => {
    open.current = editing && draft.trim() !== note ? draft.trim() : null
  })
  useEffect(
    () => () => {
      if (open.current !== null) onSave(open.current)
    },
    // The save of the last render is enough: this runs only when the note leaves the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  function start() {
    setDraft(note)
    setEditing(true)
  }

  function save(text: string) {
    const next = text.trim()
    if (next !== note) onSave(next)
  }

  function finish(text: string) {
    save(text)
    setEditing(false)
  }

  useEffect(() => {
    if (!editing || !field.current) return
    field.current.focus()
    field.current.setSelectionRange(field.current.value.length, field.current.value.length)
  }, [editing])

  // A button of the note must not take the focus from the text field: the blur would close the editor before the click.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()
  const small = 'rounded px-2 py-0.5 text-xs text-muted hover:bg-hover hover:text-ink'

  if (editing) {
    return (
      <div className="rounded-lg border border-accent/40 bg-accent/10 p-2">
        <textarea
          ref={field}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // A click outside saves the text and leaves the field open. If the field closed here, the
          // page below it would move under the pointer, and a click on a sort button would miss it.
          onBlur={() => save(draft)}
          onKeyDown={(e) => {
            // Escape and Cmd+Enter close the note. The page must not read them as its own keys.
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
              e.preventDefault()
              finish(draft)
            }
          }}
          rows={Math.min(6, Math.max(2, draft.split('\n').length))}
          maxLength={MAX_LENGTH}
          aria-label="Note for this card"
          placeholder="A note to yourself for the next time you see this card"
          className="block w-full resize-none bg-transparent px-1 text-sm placeholder:text-muted focus:outline-none"
        />
        <div className="mt-1 flex items-center justify-end gap-1">
          {draft !== '' && (
            <button type="button" onMouseDown={keepFocus} onClick={() => finish('')} className={small}>
              Clear
            </button>
          )}
          <button type="button" onMouseDown={keepFocus} onClick={() => finish(draft)} className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-on-accent hover:bg-accent-strong">
            Done
          </button>
        </div>
      </div>
    )
  }

  if (note === '') {
    return (
      <div className="flex justify-center">
        <button type="button" onClick={start} className={small}>
          + Add a note
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-lg bg-accent/10 px-3 py-2 text-sm">
      <span className="mt-0.5 shrink-0 text-xs font-semibold tracking-wide text-accent uppercase">Note</span>
      <button type="button" onClick={start} title="Edit the note" className="min-w-0 flex-1 text-left break-words whitespace-pre-wrap">
        {note}
      </button>
      <span className="flex shrink-0 gap-1">
        <button type="button" onClick={start} className={small}>
          Edit
        </button>
        <button type="button" onClick={() => onSave('')} className={small}>
          Clear
        </button>
      </span>
    </div>
  )
}
