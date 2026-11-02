import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CardSet, Folder } from '../api.ts'

const card = 'block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-400'

export function FolderCard({ folder }: { folder: Folder }) {
  return (
    <Link to={`/folders/${folder.id}`} className={card}>
      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Folder</div>
      <div className="font-medium">{folder.name}</div>
    </Link>
  )
}

export function SetCard({ set }: { set: CardSet }) {
  return (
    <Link to={`/sets/${set.id}`} className={card}>
      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{set.code_mode ? 'Set, code mode' : 'Set'}</div>
      <div className="font-medium">{set.title}</div>
    </Link>
  )
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">{children}</p>
}

export function Status({ error, loading }: { error: string | null; loading: boolean }) {
  if (error) return <p className="text-sm text-red-600">Error: {error}</p>
  if (loading) return <p className="text-sm text-gray-500">Loading</p>
  return null
}
