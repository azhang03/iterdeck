import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Folder, type ListSort } from '../api.ts'
import { useAsync, useDebounced } from '../hooks.ts'
import { PrimaryButton } from './Button.tsx'
import { Status } from './Cards.tsx'
import ListControls from './ListControls.tsx'
import Modal from './Modal.tsx'

type Choice = Pick<Folder, 'id' | 'name'> | null

type Props = { onClose: () => void; initialFolder?: Choice }

// Asks for a title and a folder, creates the set, and goes to the editor.
// The parent mounts it to open and unmounts it to close.
export default function CreateSetDialog({ onClose, initialFolder = null }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [folder, setFolder] = useState<Choice>(initialFolder)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<ListSort>('used')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const query = useDebounced(q.trim(), 200)
  const folders = useAsync(() => api.folders.list({ sort, q: query }), [sort, query])
  const mounted = useRef(true)

  useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Enter a title.')
      return
    }
    setBusy(true)
    try {
      const set = await api.sets.create(title.trim(), folder?.id ?? null)
      if (mounted.current) navigate(`/sets/${set.id}/edit`)
    } catch (err) {
      if (!mounted.current) return
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const option = (checked: boolean) =>
    `block cursor-pointer rounded px-3 py-2 text-sm ${checked ? 'bg-blue-50 font-medium text-blue-700' : 'hover:bg-gray-100'}`

  return (
    <Modal onClose={onClose} title="Create set" closable={!busy}>
      <form onSubmit={submit}>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium">Title</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <div className="mb-1 text-sm font-medium">Folder</div>
        <ListControls q={q} onQ={setQ} sort={sort} onSort={setSort} placeholder="Search folders" />
        <div className="mb-2 max-h-56 overflow-y-auto rounded border border-gray-200">
          <label className={option(folder === null)}>
            <input type="radio" name="folder" className="mr-2" checked={folder === null} onChange={() => setFolder(null)} />
            No folder
          </label>
          <div className="px-3">
            <Status error={folders.error} loading={folders.loading && !folders.data} />
          </div>
          {folders.data?.map((f) => (
            <label key={f.id} className={option(folder?.id === f.id)}>
              <input
                type="radio"
                name="folder"
                className="mr-2"
                checked={folder?.id === f.id}
                onChange={() => setFolder({ id: f.id, name: f.name })}
              />
              {f.name}
            </label>
          ))}
          {folders.data?.length === 0 && query && <p className="px-3 py-2 text-sm text-gray-500">No folders match.</p>}
        </div>
        <p className="mb-4 text-sm text-gray-600">Selected: {folder ? folder.name : 'no folder'}</p>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50">
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={busy}>
            Create
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}
