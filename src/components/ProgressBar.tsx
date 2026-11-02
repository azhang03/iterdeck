type Props = {
  done: number
  total: number
  // Learn: one segment per group, each with its size and how many of it are done.
  segments?: { size: number; done: number }[]
}

export default function ProgressBar({ done, total, segments }: Props) {
  const parts = segments ?? [{ size: total, done }]
  const all = parts.reduce((n, p) => n + p.size, 0) || 1
  return (
    <div className="mb-6">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded bg-gray-200" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
        {parts.map((p, i) => (
          <div key={i} className="relative h-full bg-gray-200" style={{ width: `${(p.size / all) * 100}%` }}>
            <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${p.size === 0 ? 0 : (p.done / p.size) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>{done} done</span>
        <span>{total - done} left</span>
      </div>
    </div>
  )
}
