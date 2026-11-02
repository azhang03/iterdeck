import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useCallback, useEffect, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { api, type SetWithCards } from '../api.ts'
import { PrimaryButton } from '../components/Button.tsx'
import CardPanel from '../components/CardPanel.tsx'
import { Status } from '../components/Cards.tsx'
import { blankCard, fromCards, sameContent, swapSides, toInputs, type EditorCard } from '../editor/cards.ts'
import { useAsync } from '../hooks.ts'

export default function Editor() {
  const { id } = useParams()
  const setId = Number(id)
  const loaded = useAsync(() => api.sets.get(setId), [setId])
  if (!loaded.data) return <Status error={loaded.error} loading={loaded.loading} />
  return <EditorForm key={setId} initial={loaded.data} />
}

function EditorForm({ initial }: { initial: SetWithCards }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(initial.title)
  const [cards, setCards] = useState<EditorCard[]>(() => {
    const list = fromCards(initial.cards)
    return list.length ? list : [blankCard()]
  })
  // What the server holds. Dirty means the page differs from this.
  const [saved, setSaved] = useState({ title: initial.title, cards: fromCards(initial.cards) })
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = title !== saved.title || !sameContent(saved.cards, cards)

  const blocker = useBlocker(dirty && !saving)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('You have unsaved changes. Leave without saving?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function save(): Promise<boolean> {
    setSaving(true)
    setError(null)
    try {
      const cleanTitle = title.trim() || saved.title
      if (cleanTitle !== saved.title) await api.sets.update(initial.id, { title: cleanTitle })
      const result = await api.sets.replaceCards(initial.id, toInputs(cards))
      const fresh = fromCards(result.cards)
      setTitle(cleanTitle)
      setSaved({ title: cleanTitle, cards: fresh })
      setCards(fresh.length ? fresh : [blankCard()])
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function done() {
    if (!dirty || (await save())) navigate(`/sets/${initial.id}`)
  }

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (!saving) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function update(key: string, patch: Partial<EditorCard>) {
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  }

  function addCard() {
    const c = blankCard()
    setCards((cs) => [...cs, c])
    setFocusKey(c.key)
  }

  function remove(key: string) {
    setCards((cs) => {
      const rest = cs.filter((c) => c.key !== key)
      return rest.length ? rest : [blankCard()]
    })
  }

  const clearFocus = useCallback(() => setFocusKey(null), [])

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  function onDragEnd(e: DragEndEvent) {
    const over = e.over
    if (!over || over.id === e.active.id) return
    setCards((cs) => arrayMove(cs, cs.findIndex((c) => c.key === e.active.id), cs.findIndex((c) => c.key === over.id)))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Title"
          className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-xl font-semibold"
        />
        <span className="text-sm text-gray-500">{saving ? 'Saving' : dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="rounded px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
        >
          Save
        </button>
        <PrimaryButton onClick={() => void done()} disabled={saving}>
          Done
        </PrimaryButton>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">Error: {error}</p>}
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setCards(swapSides)} className="rounded px-3 py-1 text-sm hover:bg-gray-100">
          Swap terms and definitions
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={cards.map((c) => c.key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
        {cards.map((card, i) => (
          <CardPanel
            key={card.key}
            card={card}
            index={i}
            focusTerm={focusKey === card.key}
            onChange={(patch) => update(card.key, patch)}
            onFocused={clearFocus}
            onDelete={() => remove(card.key)}
            onTabOut={() => {
              if (i === cards.length - 1) addCard()
              else setFocusKey(cards[i + 1].key)
            }}
          />
        ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addCard}
        className="mt-4 w-full rounded-lg border border-dashed border-gray-300 bg-white py-3 text-sm font-medium hover:border-blue-400"
      >
        Add card
      </button>
    </div>
  )
}
