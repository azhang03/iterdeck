import { python } from '@codemirror/lang-python'
import { PostgreSQL, sql } from '@codemirror/lang-sql'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Language } from '../study/languages.ts'

function languageExtension(language: Language) {
  return language === 'python' ? python() : sql({ dialect: PostgreSQL })
}

type Props = {
  language: Language
  clearToken: number
  // The page owns the text, so the editor can remount (an options change restarts
  // the session) without losing it.
  doc: RefObject<string>
}

export default function CodeEditor({ language, clearToken, doc }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const [langCompartment] = useState(() => new Compartment())
  const viewLanguage = useRef(language)

  useEffect(() => {
    if (!host.current) return
    const v = new EditorView({
      state: EditorState.create({
        doc: doc.current,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          indentUnit.of('    '),
          langCompartment.of(languageExtension(viewLanguage.current)),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) doc.current = u.state.doc.toString()
          }),
          EditorView.theme({ '&': { height: '100%' } }),
        ],
      }),
      parent: host.current,
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
  }, [doc, langCompartment])

  useEffect(() => {
    if (!view.current || viewLanguage.current === language) return
    viewLanguage.current = language
    view.current.dispatch({ effects: langCompartment.reconfigure(languageExtension(language)) })
  }, [language, langCompartment])

  useEffect(() => {
    if (clearToken === 0 || !view.current) return
    view.current.dispatch({ changes: { from: 0, to: view.current.state.doc.length, insert: '' } })
  }, [clearToken])

  return <div ref={host} className="h-full min-h-0 overflow-hidden text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto" />
}
