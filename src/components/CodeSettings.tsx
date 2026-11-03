import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Language, type SetFile } from '../api.ts'
import { LANGUAGES } from '../study/languages.ts'

type Props = {
  setId: number
  language: Language | null
  files: SetFile[]
  onLanguage: (language: Language | null) => void
  onFiles: (files: SetFile[]) => void
}

// The language a code mode set runs, and for PostgreSQL the CSV files that
// become tables. Each change is sent to the server at once; Save is not needed.
export default function CodeSettings({ setId, language, files, onLanguage, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(work: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function pickLanguage(value: string) {
    const next = value === '' ? null : (value as Language)
    void act(async () => {
      const set = await api.sets.update(setId, { language: next })
      onLanguage(set.language)
    })
  }

  function upload(file: File | undefined) {
    if (!file) return
    void act(async () => {
      const stored = await api.files.upload(setId, file)
      onFiles([...files, stored].sort((a, b) => a.table_name.localeCompare(b.table_name)))
    }).finally(() => {
      if (input.current) input.current.value = ''
    })
  }

  function remove(file: SetFile) {
    if (!window.confirm(`Remove the table ${file.table_name}?`)) return
    void act(async () => {
      await api.files.remove(setId, file.id)
      onFiles(files.filter((f) => f.id !== file.id))
    })
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Code mode</span>
        <select
          value={language ?? ''}
          onChange={(e) => pickLanguage(e.target.value)}
          disabled={busy}
          aria-label="Language"
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
        >
          <option value="">Choose a language</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      {language === null && <p className="mt-2 text-sm text-gray-500">Pick a language to run code in study mode.</p>}
      {language === 'python' && <p className="mt-2 text-sm text-gray-500">Tests are written on each card below.</p>}
      {language === 'postgresql' && (
        <div className="mt-3">
          <h3 className="text-sm font-medium">Tables (CSV files)</h3>
          {files.length === 0 && <p className="mt-1 text-sm text-gray-500">No tables yet. Each CSV file becomes a table.</p>}
          <ul className="mt-1 space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-4 rounded border border-gray-100 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-mono font-medium">{f.table_name}</span>
                    <span className="ml-2 text-gray-500">
                      {f.row_count} {f.row_count === 1 ? 'row' : 'rows'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {f.columns.map((c) => (
                      <span key={c.name} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
                        {c.name} <span className="text-gray-500">{c.type}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(f)}
                  disabled={busy}
                  aria-label={`Remove table ${f.table_name}`}
                  className="shrink-0 rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="mt-2 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
          >
            {busy ? 'Working' : 'Upload CSV'}
          </button>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">Error: {error}</p>}
      <p className="mt-2 text-xs text-gray-500">
        Code mode is turned on from the <Link to={`/sets/${setId}`} className="text-blue-700 hover:underline">set page</Link>.
      </p>
    </div>
  )
}
