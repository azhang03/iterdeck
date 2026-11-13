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
          className="h-14 w-14 rounded-full border-2 border-miss bg-surface text-2xl text-miss hover:bg-miss/10"
        >
          {'\u2715'}
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo last card"
          className="rounded px-3 py-2 text-sm hover:bg-hover disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onCheck}
          aria-label="Mark as checked (2)"
          className="h-14 w-14 rounded-full border-2 border-ok bg-surface text-2xl text-ok hover:bg-ok/10"
        >
          {'\u2713'}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Space flips, 1 marks missed, 2 marks checked.</p>
    </>
  )
}
