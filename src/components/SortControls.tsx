type Props = { onMiss: () => void; onCheck: () => void; onUndo: () => void; canUndo: boolean }

// The X, Undo, and check row under a study card, with the key hint.
export default function SortControls({ onMiss, onCheck, onUndo, canUndo }: Props) {
  return (
    <>
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onMiss}
          aria-label="Mark as missed (1)"
          className="h-14 w-14 rounded-full border-2 border-red-400 text-2xl text-red-600 hover:bg-red-50"
        >
          {'\u2715'}
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo last card"
          className="rounded px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onCheck}
          aria-label="Mark as checked (2)"
          className="h-14 w-14 rounded-full border-2 border-green-500 text-2xl text-green-700 hover:bg-green-50"
        >
          {'\u2713'}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-gray-500">Space flips, 1 marks missed, 2 marks checked.</p>
    </>
  )
}
