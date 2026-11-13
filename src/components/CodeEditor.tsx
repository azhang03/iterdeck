import { python } from '@codemirror/lang-python'
import { PostgreSQL, sql } from '@codemirror/lang-sql'
import { indentWithTab, isolateHistory } from '@codemirror/commands'
import { indentUnit, syntaxHighlighting } from '@codemirror/language'
import { setDiagnostics } from '@codemirror/lint'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useCallback, useEffect, useRef, useState } from 'react'
import { codeHighlighter } from '../editor/highlight.ts'
import type { RunError } from '../run/runner.ts'
import type { Language } from '../study/languages.ts'

// The editor's colours come from the tokens in index.css, so the editor follows
// the light and dark switch with no change to its state.
const selection = 'color-mix(in srgb, var(--color-accent) 28%, transparent)'
const editorTheme = EditorView.theme({
  '&': { height: '100%', color: 'var(--tok-plain)', backgroundColor: 'var(--color-editor)' },
  '.cm-content': { caretColor: 'var(--color-ink)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-ink)' },
  '.cm-gutters': { backgroundColor: 'var(--color-editor)', color: 'var(--color-muted)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--color-ink) 5%, transparent)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: selection },
  '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--color-accent) 14%, transparent)' },
  '.cm-tooltip, .cm-panels': { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink)', border: '1px solid var(--color-line)' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--color-hover)', border: 'none', color: 'var(--color-muted)' },
  // The search and lint panels: CodeMirror's own light fields and buttons do not fit the dark scheme.
  '.cm-textfield': { backgroundColor: 'var(--color-editor)', border: '1px solid var(--color-line)' },
  '.cm-button': { backgroundImage: 'none', backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-line)' },
  '.cm-panel.cm-panel-lint ul [aria-selected]': { backgroundColor: 'var(--color-hover)' },
})

function languageExtension(language: Language) {
  return language === 'python' ? python() : sql({ dialect: PostgreSQL })
}

type Props = {
  language: Language
  // The card whose text the editor shows. null keeps the last card's text (a summary is on screen).
  cardId: number | null
  // The page owns the texts, so the editor can remount without losing them.
  docs: Map<number, string>
  onChange: (cardId: number, text: string) => void
  onRun: () => void
  onTest: () => void
  // Replaces the whole text of the card on screen: Clear and Pull. A new `id` asks
  // for it again. The change is one editor step, so one undo brings the old text back.
  replacement: { id: number; text: string } | null
  // The last run's error; its line is marked. null clears the mark.
  diagnostics: RunError | null
}

export default function CodeEditor({ language, cardId, docs, onChange, onRun, onTest, replacement, diagnostics }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const [langCompartment] = useState(() => new Compartment())
  const viewLanguage = useRef(language)
  // The card the view shows. Updates from a card switch do not count as edits.
  const activeCard = useRef<number | null>(cardId)
  const switching = useRef(false)
  // The handlers change on every render; the view is built once.
  const handlers = useRef({ onChange, onRun, onTest })
  useEffect(() => {
    handlers.current = { onChange, onRun, onTest }
  })

  // One state per card: a fresh state keeps card A's undo history out of card B.
  const makeState = useCallback(
    (doc: string) =>
      EditorState.create({
        doc,
        extensions: [
          basicSetup,
          Prec.highest(
            keymap.of([
              { key: 'Mod-Shift-Enter', run: () => (handlers.current.onTest(), true) },
              { key: 'Mod-Enter', run: () => (handlers.current.onRun(), true) },
            ]),
          ),
          keymap.of([indentWithTab]),
          indentUnit.of('    '),
          langCompartment.of(languageExtension(viewLanguage.current)),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged || switching.current || activeCard.current === null) return
            const text = u.state.doc.toString()
            docs.set(activeCard.current, text)
            handlers.current.onChange(activeCard.current, text)
          }),
          editorTheme,
          syntaxHighlighting(codeHighlighter),
        ],
      }),
    [docs, langCompartment],
  )

  useEffect(() => {
    if (!host.current) return
    const v = new EditorView({
      state: makeState(activeCard.current === null ? '' : (docs.get(activeCard.current) ?? '')),
      parent: host.current,
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
  }, [docs, makeState])

  useEffect(() => {
    if (!view.current || cardId === null || cardId === activeCard.current) return
    activeCard.current = cardId
    switching.current = true
    view.current.setState(makeState(docs.get(cardId) ?? ''))
    switching.current = false
  }, [cardId, docs, makeState])

  useEffect(() => {
    if (!view.current || viewLanguage.current === language) return
    viewLanguage.current = language
    view.current.dispatch({ effects: langCompartment.reconfigure(languageExtension(language)) })
  }, [language, langCompartment])

  // Each id is applied one time, also when the effect runs again (StrictMode) or the
  // editor mounts again under the same replacement.
  const replaced = useRef(replacement?.id ?? 0)
  useEffect(() => {
    if (!replacement || replacement.id === replaced.current || !view.current) return
    replaced.current = replacement.id
    // Its own undo step: it must not join the keys typed just before it.
    view.current.dispatch({
      changes: { from: 0, to: view.current.state.doc.length, insert: replacement.text },
      annotations: isolateHistory.of('full'),
    })
  }, [replacement])

  useEffect(() => {
    const v = view.current
    if (!v) return
    if (!diagnostics) {
      v.dispatch(setDiagnostics(v.state, []))
      return
    }
    const lineNumber = Math.min(Math.max(diagnostics.line ?? 1, 1), v.state.doc.lines)
    const line = v.state.doc.line(lineNumber)
    v.dispatch(setDiagnostics(v.state, [{ from: line.from, to: line.to, severity: 'error', message: diagnostics.message }]))
  }, [diagnostics])

  return <div ref={host} className="h-full min-h-0 overflow-hidden text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto" />
}
