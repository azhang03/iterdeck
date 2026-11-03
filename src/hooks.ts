import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type SetWithCards } from './api.ts'

export type Async<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void }

// Runs an async loader when deps change. Ignores results from a loader that
// deps replaced before it finished.
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): Async<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    load().then(
      (d) => {
        if (!live) return
        setData(d)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!live) return
        setData(null)
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
    // The caller lists the deps that change the result; load itself is a new closure each render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

// The editor text per card in code mode, keyed by card id. A new map, seeded
// from the saved code, each time a set loads. The editor mutates it in place.
export function useCodeDocs(set: SetWithCards | null): Map<number, string> {
  return useMemo(() => {
    const docs = new Map<number, string>()
    if (set) for (const c of set.cards) if (c.code) docs.set(c.id, c.code)
    return docs
  }, [set])
}

const SAVE_DELAY_MS = 500

type PendingSave = { timer: ReturnType<typeof setTimeout>; code: string }

// Debounced PATCH of cards.code, one timer per card. Saves for one card go out
// one after another, so an older text cannot land after a newer one. Pending
// saves are sent at once on unmount and on pagehide (reload, tab close).
// A failed save is dropped; the next edit sends the text again.
export function useCodeSaver(): (cardId: number, code: string) => void {
  const pending = useRef(new Map<number, PendingSave>())
  const chains = useRef(new Map<number, Promise<void>>())

  const send = useCallback((cardId: number, code: string, keepalive = false) => {
    const prev = chains.current.get(cardId) ?? Promise.resolve()
    const next = prev.then(() => api.cards.update(cardId, { code }, { keepalive })).then(
      () => {},
      () => {},
    )
    chains.current.set(cardId, next)
  }, [])

  useEffect(() => {
    const map = pending.current
    const flush = (keepalive: boolean) => {
      for (const [cardId, p] of map) {
        clearTimeout(p.timer)
        send(cardId, p.code, keepalive)
      }
      map.clear()
    }
    const onPageHide = () => flush(true)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      flush(false)
    }
  }, [send])

  return useCallback(
    (cardId: number, code: string) => {
      const map = pending.current
      const prev = map.get(cardId)
      if (prev) clearTimeout(prev.timer)
      const timer = setTimeout(() => {
        map.delete(cardId)
        send(cardId, code)
      }, SAVE_DELAY_MS)
      map.set(cardId, { timer, code })
    },
    [send],
  )
}
