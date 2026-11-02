import { useCallback, useEffect, useState } from 'react'

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
    load().then(
      (d) => {
        if (!live) return
        setData(d)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!live) return
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
