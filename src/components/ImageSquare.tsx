import { useRef, useState } from 'react'
import { api } from '../api.ts'

type Img = { id: number; url: string }
type Props = { image: Img | null; label: string; onChange: (image: Img | null) => void }

// A square that shows the card side's image, or a button to pick one. Picking a file
// uploads it at once.
export default function ImageSquare({ image, label, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const stored = await api.images.upload(file)
      onChange({ id: stored.id, url: stored.url })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="w-20 shrink-0">
      {image ? (
        <div className="relative h-20 w-20">
          <img src={image.url} alt="" className="h-20 w-20 rounded border border-line object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label}`}
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-ink text-xs text-surface hover:bg-bad"
          >
            x
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={`Add ${label}`}
          className="h-20 w-20 rounded border border-dashed border-line text-xs text-muted hover:border-accent disabled:opacity-50"
        >
          {busy ? 'Uploading' : 'Image'}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        aria-label={`${label} file`}
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  )
}
