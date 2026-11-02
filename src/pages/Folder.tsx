import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type CardSet, type Folder as FolderRow, type ListSort } from '../api.ts'
import AddSetMenu from '../components/AddSetMenu.tsx'
import { PrimaryButton } from '../components/Button.tsx'
import { CardGrid, Empty, Status } from '../components/Cards.tsx'
import CreateSetDialog from '../components/CreateSetDialog.tsx'
import ListControls from '../components/ListControls.tsx'
import { useAsync, useDebounced } from '../hooks.ts'

export default function Folder() {
  const { id } = useParams()
  const folderId = Number(id)
  // The folder call marks it as used. The set list is a separate call, so search does not.
  const loaded = useAsync(() => api.folders.get(folderId), [folderId])
  if (!loaded.data || loaded.data.id !== folderId) return <Status error={loaded.error} loading={loaded.loading} />
  return <FolderView key={loaded.data.id} initial={loaded.data} />
}

function FolderView({ initial }: { initial: FolderRow }) {
  const navigate = useNavigate()
  const [folder, setFolder] = useState(initial)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<ListSort>('used')
  const query = useDebounced(q.trim(), 200)
  const sets = useAsync(() => api.sets.list({ folder: folder.id, sort, q: query }), [folder.id, sort, query])
  const [menu, setMenu] = useState<'none' | 'add' | 'create'>('none')
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(initial.name)
  const [error, setError] = useState<string | null>(null)

  async function rename(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    setError(null)
    try {
      setFolder(await api.folders.rename(folder.id, clean))
      setRenaming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function removeFromFolder(set: CardSet) {
    setError(null)
    try {
      await api.sets.update(set.id, { folder_id: null })
      sets.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function deleteFolder() {
    if (!window.confirm(`Delete the folder "${folder.name}"? Its sets stay.`)) return
    setError(null)
    try {
      await api.folders.remove(folder.id)
      navigate('/folders')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        {renaming ? (
          <form onSubmit={rename} className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Folder name"
              className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-xl font-semibold"
            />
            <PrimaryButton type="submit">Save</PrimaryButton>
            <button type="button" onClick={() => setRenaming(false)} className="rounded px-4 py-2 text-sm hover:bg-gray-100">
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setName(folder.name)
              setRenaming(true)
            }}
            title="Rename"
            className="rounded text-left text-2xl font-semibold hover:bg-gray-100"
          >
            {folder.name}
          </button>
        )}
        <div className="flex items-center gap-2">
          <PrimaryButton onClick={() => setMenu('add')} aria-label="Add set">
            + Add set
          </PrimaryButton>
          <button type="button" onClick={() => void deleteFolder()} className="rounded px-4 py-2 text-sm text-red-700 hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">Error: {error}</p>}
      {menu === 'add' && (
        <AddSetMenu
          folder={folder}
          onClose={() => setMenu('none')}
          onAdded={() => {
            setMenu('none')
            sets.reload()
          }}
          onCreateNew={() => setMenu('create')}
        />
      )}
      {menu === 'create' && <CreateSetDialog onClose={() => setMenu('none')} initialFolder={folder} />}

      <ListControls q={q} onQ={setQ} sort={sort} onSort={setSort} placeholder="Search sets in this folder" />
      <Status error={sets.error} loading={sets.loading} />
      {sets.data &&
        (sets.data.length === 0 ? (
          <Empty>{query ? 'No sets match.' : 'No sets in this folder yet.'}</Empty>
        ) : (
          <CardGrid>
            {sets.data.map((s) => (
              <div key={s.id} className="relative">
                <Link to={`/sets/${s.id}`} className="block rounded-lg border border-gray-200 bg-white p-4 pr-24 shadow-sm hover:border-blue-400">
                  <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{s.code_mode ? 'Set, code mode' : 'Set'}</div>
                  <div className="font-medium">{s.title}</div>
                </Link>
                <button
                  type="button"
                  onClick={() => void removeFromFolder(s)}
                  aria-label={`Remove ${s.title} from folder`}
                  className="absolute top-3 right-3 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </CardGrid>
        ))}
    </div>
  )
}
