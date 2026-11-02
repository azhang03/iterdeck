import { useState } from 'react'
import { api, type ListSort } from '../api.ts'
import { CardGrid, Empty, FolderCard, Status } from '../components/Cards.tsx'
import ListControls from '../components/ListControls.tsx'
import { useAsync, useDebounced } from '../hooks.ts'

export default function Folders() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<ListSort>('used')
  const query = useDebounced(q.trim(), 200)
  const folders = useAsync(() => api.folders.list({ sort, q: query }), [sort, query])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Folders</h1>
      </div>
      <ListControls q={q} onQ={setQ} sort={sort} onSort={setSort} placeholder="Search folders" />
      <Status error={folders.error} loading={folders.loading} />
      {folders.data &&
        (folders.data.length === 0 ? (
          <Empty>{query ? 'No folders match.' : 'No folders yet.'}</Empty>
        ) : (
          <CardGrid>
            {folders.data.map((f) => (
              <FolderCard key={f.id} folder={f} />
            ))}
          </CardGrid>
        ))}
    </div>
  )
}
