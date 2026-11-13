import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, type Card, type SetWithCards, type StudyMode } from './api.ts'
import { readWatch, runWatch, savedElapsedMs, withElapsed, type Watch } from './study/clock.ts'
import { enter, leave, type Move } from './study/motion.ts'
import { DEFAULT_OPTIONS, type StudyOptions } from './study/options.ts'

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

export type CodeSaver = {
  save: (cardId: number, code: string) => void
  // For Restart: drops pending saves, waits for the ones in flight, then runs
  // `clear`. Saves made meanwhile go out after it.
  discard: (clear: () => Promise<void>) => void
}

// Debounced PATCH of cards.code, one timer per card. Saves for one card go out
// one after another, so an older text cannot land after a newer one. Pending
// saves are sent at once on unmount and on pagehide (reload, tab close).
// A failed save is dropped; the next edit sends the text again.
export function useCodeSaver(): CodeSaver {
  const pending = useRef(new Map<number, PendingSave>())
  const chains = useRef(new Map<number, Promise<void>>())
  // Settled once the last Restart has cleared the code on the server.
  const gate = useRef(Promise.resolve())

  const send = useCallback((cardId: number, code: string, keepalive = false) => {
    const prev = chains.current.get(cardId) ?? Promise.resolve()
    const next = Promise.all([prev, gate.current])
      .then(() => api.cards.update(cardId, { code }, { keepalive }))
      .then(
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

  return useMemo(
    () => ({
      save(cardId: number, code: string) {
        const map = pending.current
        const prev = map.get(cardId)
        if (prev) clearTimeout(prev.timer)
        const timer = setTimeout(() => {
          map.delete(cardId)
          send(cardId, code)
        }, SAVE_DELAY_MS)
        map.set(cardId, { timer, code })
      },
      discard(clear: () => Promise<void>) {
        for (const p of pending.current.values()) clearTimeout(p.timer)
        pending.current.clear()
        gate.current = Promise.all(chains.current.values())
          .then(clear)
          .then(
            () => {},
            () => {},
          )
      },
    }),
    [send],
  )
}

export type ProgressSaver = {
  // `keepalive` lets the request finish after the page is gone (reload, tab close).
  save: (state: object, keepalive?: boolean) => void
  clear: () => void
}

// Saves a study session's snapshot for the set and mode. Requests go out in
// order; a snapshot equal to the last one sent is skipped. Failures are dropped.
export function useProgressSaver(setId: number, mode: StudyMode): ProgressSaver {
  const chain = useRef(Promise.resolve())
  const last = useRef<string | null>(null)
  return useMemo(() => {
    const queue = (key: string, work: () => Promise<void>) => {
      if (last.current === key) return
      last.current = key
      chain.current = chain.current.then(work).catch(() => {})
    }
    return {
      save: (state, keepalive = false) => {
        const json = JSON.stringify(state)
        queue(json, () => api.sets.saveProgress(setId, mode, JSON.parse(json) as object, { keepalive }))
      },
      clear: () => queue('', () => api.sets.clearProgress(setId, mode)),
    }
  }, [setId, mode])
}

// What a clock on screen needs: the time now, and whether it still counts.
export type SessionClock = { read: () => number; running: boolean }

// The session clock, and the save of a study session with its time. `snapshot`
// is the session's saved position, or null when the session is complete: then
// the clock stops and the saved session is dropped. The session is saved after
// every change, and once more when the session ends or the page goes away
// (reload, tab close), so the saved time includes the time on the last card.
export function useSessionClock(progress: ProgressSaver, snapshot: object | null, initialMs: number): SessionClock {
  const [first] = useState<Watch>(() => ({ ms: initialMs, since: Date.now() }))
  const watch = useRef(first)
  const read = useCallback(() => readWatch(watch.current, Date.now()), [])
  const persist = useRef((_keepalive: boolean) => {})
  const running = snapshot !== null

  // An undo on the last summary opens the session, so the clock can start again.
  // The browser can keep a page that the user left and show it again on Back.
  // The page is away from `pagehide` to `pageshow`, so the clock stops for that time.
  useEffect(() => {
    const run = (on: boolean) => {
      watch.current = runWatch(watch.current, on, Date.now())
    }
    const onPageHide = () => run(false)
    const onPageShow = () => run(running)
    run(running)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [running])

  useEffect(() => {
    persist.current = (keepalive) => {
      if (snapshot === null) progress.clear()
      else progress.save(withElapsed(snapshot, read()), keepalive)
    }
    persist.current(false)
  }, [progress, snapshot, read])

  useEffect(() => {
    const onPageHide = () => persist.current(true)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      persist.current(false)
    }
  }, [])

  return useMemo(() => ({ read, running }), [read, running])
}

// The time on the card on screen, for the result of a sort. It starts again when
// the key changes; null means no card is on screen. The card clock in the header
// counts from its own mount, which is the same moment.
export function useCardTime(cardKey: string | null): () => number {
  const [first] = useState(() => Date.now())
  const startedAt = useRef(first)
  useEffect(() => {
    startedAt.current = Date.now()
  }, [cardKey])
  return useCallback(() => Date.now() - startedAt.current, [])
}

export type StudyMotion = {
  // The ref of the card (plain layout) or of the description panel (code mode).
  target: (el: HTMLElement | null) => void
  // Call it in the handler of an action, before the state changes: the old card
  // leaves from where it is, then the new card comes in.
  play: (move: Move) => void
}

// The motion of a study page (src/study/motion.ts). It never delays the state.
export function useStudyMotion(codeMode: boolean): StudyMotion {
  const element = useRef<HTMLElement | null>(null)
  const target = useCallback((el: HTMLElement | null) => {
    element.current = el
  }, [])
  const [move, setMove] = useState<Move>({ kind: 'start' })
  const entering = useRef<Animation | null>(null)

  // Runs after the page shows the new card.
  useLayoutEffect(() => {
    const el = element.current
    entering.current?.cancel()
    entering.current = el ? enter(codeMode ? (el.querySelector<HTMLElement>('[data-motion-content]') ?? el) : el, move, codeMode) : null
  }, [move, codeMode])

  const play = useCallback(
    (next: Move) => {
      // A card that is still coming in is measured where it ends, not part way.
      entering.current?.cancel()
      entering.current = null
      if (element.current) leave(element.current, next, codeMode)
      setMove(next)
    },
    [codeMode],
  )
  return useMemo(() => ({ target, play }), [target, play])
}

export type CardNotes = {
  // The notes written in this visit, by card id. A card that is not here has the note it was loaded with.
  edited: Record<number, string>
  // With keepalive the request outlives the page; it is for the save as the page goes away.
  save: (cardId: number, note: string, keepalive?: boolean) => void
}

// The user's notes on the cards. A change shows at once and is saved in the
// background; the saves go out one after another, so an older text cannot land
// after a newer one. A failed save is dropped; the next change sends the text again.
export function useCardNotes(): CardNotes {
  const [edited, setEdited] = useState<Record<number, string>>({})
  const chain = useRef(Promise.resolve())
  const save = useCallback((cardId: number, note: string, keepalive = false) => {
    setEdited((notes) => ({ ...notes, [cardId]: note }))
    if (keepalive) {
      // The page is going away: the request cannot wait for the ones before it.
      void api.cards.update(cardId, { note }, { keepalive: true }).catch(() => {})
      return
    }
    chain.current = chain.current.then(async () => {
      await api.cards.update(cardId, { note }).catch(() => {})
    })
  }, [])
  return useMemo(() => ({ edited, save }), [edited, save])
}

type Resume<S> = (cards: Card[], saved: unknown) => { state: S; options: StudyOptions } | null

export type StudyPage<S> = {
  loaded: Async<SetWithCards>
  options: StudyOptions
  setOptions: (options: StudyOptions) => void
  sessionKey: number
  // The saved session to continue, for the first session only; null starts fresh.
  initial: S | null
  // The session time the saved session had; zero for a fresh session.
  initialElapsedMs: number
  // The saved snapshot as it was stored, when the session continues from it; null for a fresh session.
  initialSaved: unknown
  docs: Map<number, string>
  codeSaver: CodeSaver
  notes: CardNotes
  progress: ProgressSaver
  // A new session from the first card. Also clears the code written for every card.
  restart: () => void
}

// What Flashcards and Learn share: the set, the options, the saved session, the
// code per card, and Restart. A saved session brings its options back with it;
// changing an option starts a fresh session.
export function useStudyPage<S>(setId: number, mode: StudyMode, resume: Resume<S>): StudyPage<S> {
  const loaded = useAsync(() => api.sets.get(setId), [setId])
  const [chosen, setOptions] = useState<StudyOptions | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const docs = useCodeDocs(loaded.data)
  const codeSaver = useCodeSaver()
  const notes = useCardNotes()
  const progress = useProgressSaver(setId, mode)
  const set = loaded.data
  const resumed = useMemo(() => (set ? resume(set.cards, set.progress[mode]) : null), [set, mode, resume])
  const options = chosen ?? resumed?.options ?? DEFAULT_OPTIONS
  const initial = sessionKey === 0 && chosen === null ? (resumed?.state ?? null) : null
  const initialSaved = initial === null ? null : (set?.progress[mode] ?? null)
  const initialElapsedMs = savedElapsedMs(initialSaved)
  const restart = useCallback(() => {
    setSessionKey((k) => k + 1)
    docs.clear()
    codeSaver.discard(() => api.sets.clearCode(setId))
  }, [docs, codeSaver, setId])
  return { loaded, options, setOptions, sessionKey, initial, initialElapsedMs, initialSaved, docs, codeSaver, notes, progress, restart }
}
