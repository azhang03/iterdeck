import { useState } from 'react'
import { api, type ListSort } from '../api.ts'
import { CardGrid, Empty, SetCard, Status } from '../components/Cards.tsx'
import ListControls from '../components/ListControls.tsx'
import { useAsync, useDebounced } from '../hooks.ts'

export default function Sets() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<ListSort>('used')
  const query = useDebounced(q.trim(), 200)
  const sets = useAsync(() => api.sets.list({ sort, q: query }), [sort, query])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sets</h1>
      </div>
      <ListControls q={q} onQ={setQ} sort={sort} onSort={setSort} placeholder="Search sets" />
      <Status error={sets.error} loading={sets.loading} />
      {sets.data &&
        (sets.data.length === 0 ? (
          <Empty>{query ? 'No sets match.' : 'No sets yet.'}</Empty>
        ) : (
          <CardGrid>
            {sets.data.map((s) => (
              <SetCard key={s.id} set={s} />
            ))}
          </CardGrid>
        ))}
    </div>
  )
}
