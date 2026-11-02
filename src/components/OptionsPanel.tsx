import type { StudyOptions } from '../study/options.ts'
import { PrimaryButton } from './Button.tsx'
import Modal from './Modal.tsx'

type Props = {
  options: StudyOptions
  onChange: (options: StudyOptions) => void
  onRestart: () => void
  onClose: () => void
  showGroupSize?: boolean
}

export default function OptionsPanel({ options, onChange, onRestart, onClose, showGroupSize = false }: Props) {
  return (
    <Modal onClose={onClose} title="Options">
      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-medium">Front of the card</legend>
        {(['term', 'definition'] as const).map((side) => (
          <label key={side} className="mr-4 text-sm">
            <input type="radio" name="front" className="mr-1" checked={options.front === side} onChange={() => onChange({ ...options, front: side })} />
            {side === 'term' ? 'Term' : 'Definition'}
          </label>
        ))}
      </fieldset>
      <label className="mb-4 block text-sm">
        <input type="checkbox" className="mr-2" checked={options.starredOnly} onChange={(e) => onChange({ ...options, starredOnly: e.target.checked })} />
        Study only starred cards
      </label>
      {showGroupSize && (
        <label className="mb-4 block text-sm">
          <span className="mr-2">Cards per group</span>
          <input
            type="number"
            min={1}
            max={50}
            value={options.groupSize}
            onChange={(e) => onChange({ ...options, groupSize: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
            className="w-20 rounded border border-gray-300 px-2 py-1"
          />
        </label>
      )}
      <div className="flex justify-between">
        <button type="button" onClick={onRestart} className="rounded px-4 py-2 text-sm text-red-700 hover:bg-red-50">
          Restart
        </button>
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </div>
    </Modal>
  )
}
