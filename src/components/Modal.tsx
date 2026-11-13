import { useEffect, useRef, type ReactNode } from 'react'

type Props = { onClose: () => void; title: string; children: ReactNode; closable?: boolean }

// A modal on the native dialog element. It opens when mounted; the parent
// unmounts it to close. Escape and a click on the backdrop call onClose.
// With closable false (a request in flight), Escape and the backdrop do nothing.
export default function Modal({ onClose, title, children, closable = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  // A click counts as a backdrop click only when the press started on the backdrop too,
  // so a drag out of an input does not close the dialog.
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        if (!closable) e.preventDefault()
      }}
      onClose={onClose}
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === ref.current
      }}
      onClick={(e) => {
        if (closable && pressedBackdrop.current && e.target === ref.current) onClose()
      }}
      className="w-full max-w-lg rounded-lg bg-surface p-0 text-ink shadow-xl backdrop:bg-black/30 open:fixed open:top-1/2 open:left-1/2 open:-translate-x-1/2 open:-translate-y-1/2"
    >
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}
