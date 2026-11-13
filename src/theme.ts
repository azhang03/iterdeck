import { useSyncExternalStore } from 'react'

// The colour scheme of the app. It is the `data-theme` attribute of <html>:
// index.css gives each scheme its colours. The script in index.html sets the
// attribute before the first paint, from the saved choice or, with none, from
// the system setting. That script reads the same storage key.
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'iterdeck-theme'
const listeners = new Set<() => void>()

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function toggleTheme() {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage can be off (private mode). The choice then lasts until a reload.
  }
  for (const listener of listeners) listener()
}

// The scheme in use and the function that switches to the other one.
export function useTheme(): [Theme, () => void] {
  return [useSyncExternalStore(subscribe, currentTheme), toggleTheme]
}
