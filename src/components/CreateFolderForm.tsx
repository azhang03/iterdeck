import { useState, type FormEvent } from 'react'
import { api, type Folder } from '../api.ts'
import { PrimaryButton } from './Button.tsx'

type Props = { onCreated: (folder: Folder) => void; onCancel: () => void }

export default function CreateFolderForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter a name.')
      return
    }
    try {
      onCreated(await api.folders.create(name.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <PrimaryButton type="submit">Create</PrimaryButton>
      <button type="button" onClick={onCancel} className="rounded px-4 py-2 text-sm hover:bg-gray-100">
        Cancel
      </button>
    </form>
  )
}
