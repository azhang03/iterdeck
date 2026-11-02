import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home' },
  { to: '/folders', label: 'Folders' },
  { to: '/sets', label: 'Sets' },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <nav className="w-48 shrink-0 border-r border-gray-200 bg-white p-4">
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
                  `block rounded px-3 py-2 text-sm ${isActive ? 'bg-blue-50 font-medium text-blue-700' : 'hover:bg-gray-100'}`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
