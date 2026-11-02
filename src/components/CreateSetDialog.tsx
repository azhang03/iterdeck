import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type ListSort } from '../api.ts'
import { useAsync, useDebounced } from '../hooks.ts'
import { PrimaryButton } from './Button.tsx'
import ListControls from './ListControls.tsx'
import Modal from './Modal.tsx'

type Props = { open: boolean; onClose: () => void; initialFolderId?: number | null }

// Asks for a title and a folder, creates the set, and goes to the editor.
export default function CreateSetDialog({ open, onClose, initialFolderId = null }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [folderId, setFolderId] = useState<number | null>(initialFolderId)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<ListSort>('used')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const query = useDebounced(q.trim(), 200)
  const folders = useAsync(() => (open ? api.folders.list({ sort, q: query }) : Promise.resolve([])), [open, sort, query])

  useEffect(() => {
    if (!open) return
    setTitle('')
    setFolderId(initialFolderId)
    setQ('')
    setError(null)
    setBusy(false)
  }, [open, initialFolderId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Enter a title.')
      return
    }
    setBusy(true)
    try {
      const set = await api.sets.create(title.trim(), folderId)
      navigate(`/sets/${set.id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const option = (checked: boolean) =>
    `block cursor-pointer rounded px-3 py-2 text-sm ${checked ? 'bg-blue-50 font-medium text-blue-700' : 'hover:bg-gray-100'}`

  return (
    <Modal open={open} onClose={onClose} title="Create set">
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
        <div className="mb-4 max-h-56 overflow-y-auto rounded border border-gray-200">
          <label className={option(folderId === null)}>
            <input type="radio" name="folder" className="mr-2" checked={folderId === null} onChange={() => setFolderId(null)} />
            No folder
          </label>
          {folders.data?.map((f) => (
            <label key={f.id} className={option(folderId === f.id)}>
              <input type="radio" name="folder" className="mr-2" checked={folderId === f.id} onChange={() => setFolderId(f.id)} />
              {f.name}
            </label>
          ))}
          {folders.data?.length === 0 && query && <p className="px-3 py-2 text-sm text-gray-500">No folders match.</p>}
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm hover:bg-gray-100">
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
