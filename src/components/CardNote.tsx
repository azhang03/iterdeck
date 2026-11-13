import { useEffect, useRef, useState } from 'react'

type Props = {
  note: string
  // Saves the note. An empty text removes it. With keepalive the save outlives the page.
  onSave: (note: string, keepalive?: boolean) => void
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
  // The refs hold the text to save and the save function of the last render.
  const unsaved = useRef<string | null>(null)
  const saveLatest = useRef(onSave)
  useEffect(() => {
    unsaved.current = editing && draft.trim() !== note ? draft.trim() : null
    saveLatest.current = onSave
  })
  useEffect(
    () => () => {
      if (unsaved.current !== null) saveLatest.current(unsaved.current)
    },
    [],
  )
  // The same for a reload or a closed tab, where no blur and no unmount come first.
  useEffect(() => {
    const onHide = () => {
      if (unsaved.current !== null) saveLatest.current(unsaved.current, true)
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

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

  // A button of the note keeps the focus in the text field, so a click on it does not also save the text through the blur.
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
            <button type="button" onMouseDown={keepFocus} onClick={() => finish('')} aria-label="Clear the note" className={small}>
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
    // A long note scrolls in the strip. In code mode it must not push the sort buttons out of the panel.
    <div className="flex max-h-32 items-start gap-3 overflow-y-auto rounded-lg bg-accent/10 px-3 py-2 text-sm">
      <span className="mt-0.5 shrink-0 text-xs font-semibold tracking-wide text-accent uppercase">Note</span>
      <button type="button" onClick={start} title="Edit the note" className="min-w-0 flex-1 text-left break-words whitespace-pre-wrap">
        {note}
      </button>
      <span className="sticky top-0 flex shrink-0 gap-1">
        <button type="button" onClick={start} aria-label="Edit the note" className={small}>
          Edit
        </button>
        <button type="button" onClick={() => onSave('')} aria-label="Clear the note" className={small}>
          Clear
        </button>
      </span>
    </div>
  )
}
