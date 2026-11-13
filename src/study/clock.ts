// The study clocks. A stopwatch is data: `ms` is the time counted before
// `since`, and `since` is the time it last started, or null when it is stopped.
// The caller gives the current time, so the functions stay pure.

export type Watch = { ms: number; since: number | null }

export function readWatch(w: Watch, now: number): number {
  return w.since === null ? w.ms : w.ms + Math.max(0, now - w.since)
}

// Starts or stops the stopwatch. Returns the same object when nothing changes.
export function runWatch(w: Watch, running: boolean, now: number): Watch {
  if (running === (w.since !== null)) return w
  return running ? { ms: w.ms, since: now } : { ms: readWatch(w, now), since: null }
}

// 0:07, 12:05, 1:02:03. Whole seconds, rounded down.
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const seconds = String(total % 60).padStart(2, '0')
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

// The session time travels with the saved snapshot of a study session.
export function withElapsed<T extends object>(snapshot: T, ms: number): T & { elapsedMs: number } {
  return { ...snapshot, elapsedMs: Math.round(ms) }
}

// The session time in a saved snapshot. Zero when the snapshot has none.
export function savedElapsedMs(saved: unknown): number {
  if (typeof saved !== 'object' || saved === null || !('elapsedMs' in saved)) return 0
  const ms = saved.elapsedMs
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : 0
}
