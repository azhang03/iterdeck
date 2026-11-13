import { describe, expect, it } from 'vitest'
import { formatClock, readWatch, runWatch, savedElapsedMs, withElapsed, type Watch } from './clock.ts'

describe('watch', () => {
  it('counts from the start time while it runs', () => {
    const w: Watch = { ms: 5000, since: 1000 }
    expect(readWatch(w, 1000)).toBe(5000)
    expect(readWatch(w, 4000)).toBe(8000)
  })

  it('does not count while it is stopped', () => {
    const stopped = runWatch({ ms: 5000, since: 1000 }, false, 4000)
    expect(stopped).toEqual({ ms: 8000, since: null })
    expect(readWatch(stopped, 60000)).toBe(8000)
  })

  it('leaves out the stopped time when it starts again', () => {
    const stopped = runWatch({ ms: 0, since: 0 }, false, 3000)
    const again = runWatch(stopped, true, 10000)
    expect(readWatch(again, 12000)).toBe(5000)
  })

  it('returns the same object when the state does not change', () => {
    const running: Watch = { ms: 0, since: 0 }
    const stopped: Watch = { ms: 7, since: null }
    expect(runWatch(running, true, 500)).toBe(running)
    expect(runWatch(stopped, false, 500)).toBe(stopped)
  })

  it('does not go back when the system time does', () => {
    expect(readWatch({ ms: 2000, since: 5000 }, 4000)).toBe(2000)
  })
})

describe('formatClock', () => {
  it('shows minutes and seconds below one hour', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(7999)).toBe('0:07')
    expect(formatClock(725000)).toBe('12:05')
    expect(formatClock(3599999)).toBe('59:59')
  })

  it('shows hours from one hour', () => {
    expect(formatClock(3600000)).toBe('1:00:00')
    expect(formatClock(3723000)).toBe('1:02:03')
    expect(formatClock(36000000)).toBe('10:00:00')
  })

  it('shows zero for a negative time', () => {
    expect(formatClock(-5)).toBe('0:00')
  })
})

describe('saved session time', () => {
  it('reads back the time that was saved with a snapshot', () => {
    const saved = JSON.parse(JSON.stringify(withElapsed({ index: 3 }, 61234.6)))
    expect(saved).toEqual({ index: 3, elapsedMs: 61235 })
    expect(savedElapsedMs(saved)).toBe(61235)
  })

  it('gives zero for a snapshot with no time or a bad one', () => {
    expect(savedElapsedMs(null)).toBe(0)
    expect(savedElapsedMs({ index: 3 })).toBe(0)
    expect(savedElapsedMs({ elapsedMs: '9' })).toBe(0)
    expect(savedElapsedMs({ elapsedMs: -1 })).toBe(0)
    expect(savedElapsedMs({ elapsedMs: null })).toBe(0)
  })
})
