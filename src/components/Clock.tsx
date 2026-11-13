import { useEffect, useState } from 'react'
import { formatClock } from '../study/clock.ts'

type Props = {
  label: string
  // The time to show, in milliseconds. Without it the clock counts from its mount.
  read?: () => number
  // False keeps the last time on screen.
  running?: boolean
}

// Shows a stopwatch and updates it each second. Give a clock that counts from
// its mount a new key to start it again from zero.
export default function Clock({ label, read, running = true }: Props) {
  const [mountedAt] = useState(() => Date.now())
  const [text, setText] = useState(() => formatClock(read ? read() : 0))

  useEffect(() => {
    const tick = () => setText(formatClock(read ? read() : Date.now() - mountedAt))
    tick()
    if (!running) return
    // Faster than one second, so a late tick does not skip a second on screen.
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [read, running, mountedAt])

  return (
    <span role="timer" className="text-sm whitespace-nowrap text-muted">
      {label} <span className="font-mono text-ink tabular-nums">{text}</span>
    </span>
  )
}
