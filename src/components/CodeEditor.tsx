import { python } from '@codemirror/lang-python'
import { PostgreSQL, sql } from '@codemirror/lang-sql'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef } from 'react'
import type { Language } from '../study/languages.ts'

function languageExtension(language: Language) {
  return language === 'python' ? python() : sql({ dialect: PostgreSQL })
}

type Props = { language: Language; clearToken: number }

// A CodeMirror editor. The content lives in the editor and survives card changes;
// a new clearToken empties it. The language switches in place.
export default function CodeEditor({ language, clearToken }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const langCompartment = useRef(new Compartment())

  useEffect(() => {
    if (!host.current) return
    const v = new EditorView({
      state: EditorState.create({
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          indentUnit.of('    '),
          langCompartment.current.of(languageExtension(language)),
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
    // The language and clear token are handled by the effects below.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    view.current?.dispatch({ effects: langCompartment.current.reconfigure(languageExtension(language)) })
  }, [language])

  useEffect(() => {
    if (clearToken === 0 || !view.current) return
    view.current.dispatch({ changes: { from: 0, to: view.current.state.doc.length, insert: '' } })
  }, [clearToken])

  return <div ref={host} className="h-full min-h-0 overflow-hidden text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto" />
}
