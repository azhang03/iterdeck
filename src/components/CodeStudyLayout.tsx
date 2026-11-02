import { useEffect, useState, type ReactNode } from 'react'
import { LANGUAGES, storedLanguage, storeLanguage, type Language } from '../study/languages.ts'
import CodeEditor from './CodeEditor.tsx'

export type FocusSide = 'card' | 'editor'

type Props = {
  setId: number
  focusSide: FocusSide
  onFocusSide: (side: FocusSide) => void
  panel: ReactNode // the description panel content (the card, a summary, or a debrief)
  footer?: ReactNode // sort buttons, sticky at the bottom of the panel
}

// Code mode: the card as a problem description on the left, a code editor on the right.
// The side clicked last gets the keys; a visible outline marks it.
export default function CodeStudyLayout({ setId, focusSide, onFocusSide, panel, footer }: Props) {
  const [language, setLanguage] = useState<Language>(() => storedLanguage(setId))
  const [clearToken, setClearToken] = useState(0)

  useEffect(() => {
    storeLanguage(setId, language)
  }, [setId, language])

  const outline = (side: FocusSide) =>
    `flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${focusSide === side ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`

  return (
    <div className="grid h-[calc(100vh-11rem)] min-h-96 grid-cols-2 gap-4">
      <section aria-label="Description" onMouseDownCapture={() => onFocusSide('card')} className={outline('card')}>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{panel}</div>
        {footer && <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">{footer}</div>}
      </section>
      <section aria-label="Code editor" onMouseDownCapture={() => onFocusSide('editor')} className={outline('editor')}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            aria-label="Language"
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setClearToken((t) => t + 1)} className="rounded px-3 py-1 text-sm hover:bg-gray-100">
            Clear
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <CodeEditor language={language} clearToken={clearToken} />
        </div>
      </section>
    </div>
  )
}
