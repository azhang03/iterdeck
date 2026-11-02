import { useState } from 'react'
import { api } from '../api.ts'
import { PrimaryButton } from '../components/Button.tsx'
import { CardGrid, Empty, FolderCard, SetCard, Status } from '../components/Cards.tsx'
import CreateSetDialog from '../components/CreateSetDialog.tsx'
import { useAsync } from '../hooks.ts'

const RECENT = 6

export default function Home() {
  const folders = useAsync(() => api.folders.list({ sort: 'used' }), [])
  const sets = useAsync(() => api.sets.list({ sort: 'used' }), [])
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Home</h1>
        <PrimaryButton onClick={() => setCreating(true)}>Create set</PrimaryButton>
      </div>
      {creating && <CreateSetDialog onClose={() => setCreating(false)} />}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-medium">Recent folders</h2>
        <Status error={folders.error} loading={folders.loading} />
        {folders.data &&
          (folders.data.length === 0 ? (
            <Empty>No folders yet.</Empty>
          ) : (
            <CardGrid>
              {folders.data.slice(0, RECENT).map((f) => (
                <FolderCard key={f.id} folder={f} />
              ))}
            </CardGrid>
          ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Recent sets</h2>
        <Status error={sets.error} loading={sets.loading} />
        {sets.data &&
          (sets.data.length === 0 ? (
            <Empty>No sets yet.</Empty>
          ) : (
            <CardGrid>
              {sets.data.slice(0, RECENT).map((s) => (
                <SetCard key={s.id} set={s} />
              ))}
            </CardGrid>
          ))}
      </section>
    </div>
  )
}
