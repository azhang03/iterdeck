import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Card, type SetWithCards } from '../api.ts'
import { PrimaryButton } from '../components/Button.tsx'
import CardRow from '../components/CardRow.tsx'
import { Empty, Status } from '../components/Cards.tsx'
import { useAsync } from '../hooks.ts'
import { orderCards, percent, type CardOrder } from '../study/stats.ts'

export default function Set() {
  const { id } = useParams()
  const setId = Number(id)
  const loaded = useAsync(() => api.sets.get(setId), [setId])

  useEffect(() => {
    void api.sets.open(setId).catch(() => {})
  }, [setId])

  if (!loaded.data || loaded.data.id !== setId) return <Status error={loaded.error} loading={loaded.loading} />
  return <SetView key={loaded.data.id} initial={loaded.data} />
}

function SetView({ initial }: { initial: SetWithCards }) {
  const navigate = useNavigate()
  const [set, setSet] = useState(initial)
  const [cards, setCards] = useState<Card[]>(initial.cards)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<CardOrder>('original')

  function replaceCard(card: Card) {
    setCards((cs) => cs.map((c) => (c.id === card.id ? card : c)))
  }

  async function toggleCodeMode() {
    try {
      setSet({ ...set, ...(await api.sets.update(set.id, { code_mode: !set.code_mode })) })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the set "${set.title}" and its ${cards.length} cards?`)) return
    try {
      await api.sets.remove(set.id)
      navigate('/sets')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {set.folder && (
        <p className="mb-2 text-sm text-gray-500">
          in{' '}
          <Link to={`/folders/${set.folder.id}`} className="text-blue-700 hover:underline">
            {set.folder.name}
          </Link>
        </p>
      )}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{set.title}</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={set.code_mode === 1} onChange={() => void toggleCodeMode()} />
            Code mode
          </label>
          <Link to={`/sets/${set.id}/edit`} className="rounded px-4 py-2 text-sm hover:bg-gray-100">
            Edit
          </Link>
          <button type="button" onClick={() => void remove()} className="rounded px-4 py-2 text-sm text-red-700 hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">Error: {error}</p>}

      <div className="mb-8 grid grid-cols-2 gap-4">
        <StudyLink to={`/sets/${set.id}/flashcards`} title="Flashcards" text="Flip and sort every card." />
        <StudyLink to={`/sets/${set.id}/learn`} title="Learn" text="Work through the cards in groups." />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Cards ({cards.length})</h2>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as CardOrder)}
          aria-label="Card order"
          className="rounded border border-gray-300 bg-white px-3 py-1 text-sm"
        >
          <option value="original">Original</option>
          <option value="stats-asc">Stats (low to high)</option>
          <option value="stats-desc">Stats (high to low)</option>
        </select>
      </div>
      {cards.length === 0 ? (
        <Empty>
          No cards yet. <PrimaryButton onClick={() => navigate(`/sets/${set.id}/edit`)}>Open the editor</PrimaryButton>
        </Empty>
      ) : (
        <div className="space-y-3">
          {orderCards(cards, order).map((c) => (
            <CardRow key={c.id} card={c} onChange={replaceCard} stat={order === 'original' ? undefined : { percent: percent(c) }} />
          ))}
        </div>
      )}
    </div>
  )
}

function StudyLink({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <Link to={to} className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-blue-400">
      <div className="text-xl font-semibold">{title}</div>
      <div className="text-sm text-gray-500">{text}</div>
    </Link>
  )
}
