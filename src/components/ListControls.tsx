import type { ListSort } from '../api.ts'

const SORTS: { value: ListSort; label: string }[] = [
  { value: 'used', label: 'Recently used' },
  { value: 'created', label: 'Date created' },
  { value: 'name', label: 'Name' },
]

type Props = {
  q: string
  onQ: (q: string) => void
  sort: ListSort
  onSort: (s: ListSort) => void
  placeholder: string
}

export default function ListControls({ q, onQ, sort, onSort, placeholder }: Props) {
  return (
    <div className="mb-4 flex gap-3">
      <input
        type="search"
        value={q}
        onChange={(e) => onQ(e.target.value)}
        onKeyDown={(e) => {
          // Inside a form (the create set dialog), Enter in the search must not submit.
          if (e.key === 'Enter') e.preventDefault()
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm"
      />
      <select
        value={sort}
        onChange={(e) => onSort(e.target.value as ListSort)}
        aria-label="Sort"
        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}
