import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CardSet } from '../api.ts'

type Props = { set: CardSet; mode: string; round?: number; actions: ReactNode; children: ReactNode; wide?: boolean }

// Full-page frame for a study mode: back link, title, round, action buttons, then the content.
export default function StudyShell({ set, mode, round, actions, children, wide = false }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="min-w-0">
          <Link to={`/sets/${set.id}`} className="text-sm text-blue-700 hover:underline">
            Back to {set.title}
          </Link>
          <div className="text-sm text-gray-500">
            {mode}
            {round !== undefined && ` · Round ${round}`}
          </div>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </header>
      <main className={`mx-auto px-6 py-6 ${wide ? 'max-w-7xl' : 'max-w-3xl py-8'}`}>{children}</main>
    </div>
  )
}
