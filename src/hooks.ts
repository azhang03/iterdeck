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

// Debounced PATCH of cards.code, one timer per card, flushed on unmount.
// A failed save is dropped; the next edit sends the text again.
export function useCodeSaver(): (cardId: number, code: string) => void {
  const pending = useRef(new Map<number, { timer: ReturnType<typeof setTimeout>; code: string }>())
  useEffect(() => {
    const map = pending.current
    return () => {
      for (const [cardId, p] of map) {
        clearTimeout(p.timer)
        void api.cards.update(cardId, { code: p.code }).catch(() => {})
      }
      map.clear()
    }
  }, [])
  return useCallback((cardId: number, code: string) => {
    const map = pending.current
    const prev = map.get(cardId)
    if (prev) clearTimeout(prev.timer)
    const timer = setTimeout(() => {
      map.delete(cardId)
      void api.cards.update(cardId, { code }).catch(() => {})
    }, SAVE_DELAY_MS)
    map.set(cardId, { timer, code })
  }, [])
}
