import { NavLink, Outlet } from 'react-router-dom'
import ThemeToggle from './ThemeToggle.tsx'

const links = [
  { to: '/', label: 'Home' },
  { to: '/folders', label: 'Folders' },
  { to: '/sets', label: 'Sets' },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-page text-ink">
      <nav className="flex w-48 shrink-0 flex-col border-r border-line bg-surface p-4">
        <NavLink to="/" className="mb-6 block text-lg font-semibold">
          Iterdeck
        </NavLink>
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `block rounded px-3 py-2 text-sm ${isActive ? 'bg-accent/10 font-medium text-accent' : 'hover:bg-hover'}`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <ThemeToggle className="mt-auto self-start" />
      </nav>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
