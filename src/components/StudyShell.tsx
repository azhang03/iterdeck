import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CardSet } from '../api.ts'

type Props = { set: CardSet; mode: string; round?: number; clocks?: ReactNode; actions: ReactNode; children: ReactNode; wide?: boolean }

// Full-page frame for a study mode: back link, title, round, clocks, action buttons, then the content.
// Wide (code mode) fills the viewport height as a column, so the panels get the rest.
export default function StudyShell({ set, mode, round, clocks, actions, children, wide = false }: Props) {
  return (
    <div className={`bg-gray-50 text-gray-900 ${wide ? 'flex h-screen flex-col' : 'min-h-screen'}`}>
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="min-w-0">
          <Link to={`/sets/${set.id}`} className="text-sm text-blue-700 hover:underline">
            Back to {set.title}
          </Link>
          <div className="text-sm text-gray-500">
            {mode}
            {round !== undefined && ` · Round ${round}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {clocks && <div className="mr-2 flex items-center gap-4">{clocks}</div>}
          {actions}
        </div>
      </header>
      <main className={wide ? 'mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-6 py-6' : 'mx-auto max-w-3xl px-6 py-8'}>{children}</main>
    </div>
  )
}
