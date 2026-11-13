import { useState } from 'react'
import { api, type CardSet, type Folder, type ListSort } from '../api.ts'
import { useAsync, useDebounced } from '../hooks.ts'
import { PrimaryButton } from './Button.tsx'
import { Status } from './Cards.tsx'
import ListControls from './ListControls.tsx'
import Modal from './Modal.tsx'

type Props = {
  folder: Pick<Folder, 'id' | 'name'>
  onClose: () => void
  onAdded: (set: CardSet) => void
  onCreateNew: () => void
}

// Lists the sets that are not in this folder. Picking one moves it in.
export default function AddSetMenu({ folder, onClose, onAdded, onCreateNew }: Props) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<ListSort>('used')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const query = useDebounced(q.trim(), 200)
  const sets = useAsync(() => api.sets.list({ sort, q: query }), [sort, query])
  const candidates = sets.data?.filter((s) => s.folder_id !== folder.id) ?? []

  async function add(set: CardSet) {
    setBusyId(set.id)
    setError(null)
    try {
      onAdded(await api.sets.update(set.id, { folder_id: folder.id }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusyId(null)
    }
  }

  return (
    <Modal onClose={onClose} title={`Add a set to ${folder.name}`} closable={busyId === null}>
      <ListControls q={q} onQ={setQ} sort={sort} onSort={setSort} placeholder="Search sets" />
      <div className="mb-4 max-h-72 overflow-y-auto rounded border border-line">
        <div className="px-3">
          <Status error={sets.error} loading={sets.loading && !sets.data} />
        </div>
        {candidates.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => void add(s)}
            disabled={busyId !== null}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-hover disabled:opacity-50"
          >
            {s.title}
            {s.folder_id !== null && <span className="ml-2 text-xs text-muted">(in another folder)</span>}
          </button>
        ))}
        {sets.data && candidates.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted">
            {query ? 'No sets match.' : sets.data.length === 0 ? 'No sets yet.' : 'Every set is already in this folder.'}
          </p>
        )}
      </div>
      {error && <p className="mb-3 text-sm text-bad">{error}</p>}
      <div className="flex justify-between">
        <PrimaryButton onClick={onCreateNew} disabled={busyId !== null}>
          Create new set
        </PrimaryButton>
        <button type="button" onClick={onClose} disabled={busyId !== null} className="rounded px-4 py-2 text-sm hover:bg-hover disabled:opacity-50">
          Close
        </button>
      </div>
    </Modal>
  )
}
