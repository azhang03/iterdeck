import { useTheme } from '../theme.ts'

// Switches between the light and the dark scheme. The label names the scheme the
// button switches to.
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, toggle] = useTheme()
  const to = theme === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" onClick={toggle} aria-label={`Switch to ${to} colours`} className={`rounded px-3 py-1 text-sm hover:bg-hover ${className}`}>
      {to === 'dark' ? '\u263e\ufe0e Dark' : '\u2600\ufe0e Light'}
    </button>
  )
}
