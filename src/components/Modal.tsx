import { useEffect, useRef, type ReactNode } from 'react'

type Props = { onClose: () => void; title: string; children: ReactNode }

// A modal on the native dialog element. It opens when mounted; the parent
// unmounts it to close. Escape and a click on the backdrop call onClose.
export default function Modal({ onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="w-full max-w-lg rounded-lg p-0 shadow-xl backdrop:bg-black/30 open:fixed open:top-1/2 open:left-1/2 open:-translate-x-1/2 open:-translate-y-1/2"
    >
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}
