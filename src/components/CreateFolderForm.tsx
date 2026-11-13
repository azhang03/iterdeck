import { useState, type FormEvent } from 'react'
import { api, type Folder } from '../api.ts'
import { PrimaryButton } from './Button.tsx'

type Props = { onCreated: (folder: Folder) => void; onCancel: () => void }

export default function CreateFolderForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter a name.')
      return
    }
    setBusy(true)
    try {
      onCreated(await api.folders.create(name.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 flex items-start gap-2">
      <div className="flex-1">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name"
          aria-label="Folder name"
          className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
        />
        {error && <p className="mt-1 text-sm text-bad">{error}</p>}
      </div>
      <PrimaryButton type="submit" disabled={busy}>
        Create
      </PrimaryButton>
      <button type="button" onClick={onCancel} disabled={busy} className="rounded px-4 py-2 text-sm hover:bg-hover disabled:opacity-50">
        Cancel
      </button>
    </form>
  )
}
