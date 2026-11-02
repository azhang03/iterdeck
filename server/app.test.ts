import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Server } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { sweepOrphanImages } from './images.ts'
import { openDb, type Db } from './db.ts'
import type { Card, CardSet, Folder, Image, SetWithCards } from '../shared/types.ts'

let dir: string
let db: Db
let server: Server
let base: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'iterdeck-test-'))
  db = openDb(join(dir, 'test.db'))
  const app = createApp(db, join(dir, 'images'))
  // Node 20 has no Promise.withResolvers.
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve())
  })
  const address = server.address()
  if (typeof address !== 'object' || !address) throw new Error('no address')
  base = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM cards; DELETE FROM sets; DELETE FROM folders; DELETE FROM images;')
})

async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const init: RequestInit = { method }
  if (body instanceof FormData) init.body = body
  else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(base + path, init)
  const data = res.status === 204 ? undefined : await res.json()
  return { status: res.status, data: data as T }
}

async function makeSet(title: string, folder_id: number | null = null): Promise<CardSet> {
  return (await call<CardSet>('POST', '/api/sets', { title, folder_id })).data
}

async function putCards(setId: number, cards: unknown[]): Promise<SetWithCards> {
  return (await call<SetWithCards>('PUT', `/api/sets/${setId}/cards`, cards)).data
}

function setClock(table: string, id: number, column: string, iso: string) {
  db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run(iso, id)
}

describe('folders', () => {
  it('rejects an empty name', async () => {
    const r = await call('POST', '/api/folders', { name: '  ' })
    expect(r.status).toBe(400)
  })

  it('lists by created, used, and name', async () => {
    const a = (await call<Folder>('POST', '/api/folders', { name: 'beta' })).data
    const b = (await call<Folder>('POST', '/api/folders', { name: 'Alpha' })).data
    setClock('folders', a.id, 'created_at', '2026-01-01T00:00:00.000Z')
    setClock('folders', b.id, 'created_at', '2026-01-02T00:00:00.000Z')
    setClock('folders', a.id, 'last_used_at', '2026-03-01T00:00:00.000Z')
    setClock('folders', b.id, 'last_used_at', '2026-02-01T00:00:00.000Z')

    const created = (await call<Folder[]>('GET', '/api/folders?sort=created')).data.map((f) => f.name)
    expect(created).toEqual(['Alpha', 'beta'])
    const used = (await call<Folder[]>('GET', '/api/folders?sort=used')).data.map((f) => f.name)
    expect(used).toEqual(['beta', 'Alpha'])
    const name = (await call<Folder[]>('GET', '/api/folders?sort=name')).data.map((f) => f.name)
    expect(name).toEqual(['Alpha', 'beta'])
  })

  it('searches by substring and escapes LIKE wildcards', async () => {
    await call('POST', '/api/folders', { name: 'SQL 100%' })
    await call('POST', '/api/folders', { name: 'SQL basics' })
    const pct = (await call<Folder[]>('GET', '/api/folders?q=100%25')).data
    expect(pct.map((f) => f.name)).toEqual(['SQL 100%'])
    const all = (await call<Folder[]>('GET', '/api/folders?q=sql')).data
    expect(all).toHaveLength(2)
  })

  it('opening a folder updates last_used_at and lists only its sets', async () => {
    const f = (await call<Folder>('POST', '/api/folders', { name: 'f' })).data
    setClock('folders', f.id, 'last_used_at', '2020-01-01T00:00:00.000Z')
    await makeSet('inside', f.id)
    await makeSet('outside')
    const r = await call<Folder & { sets: CardSet[] }>('GET', `/api/folders/${f.id}`)
    expect(r.data.sets.map((s) => s.title)).toEqual(['inside'])
    expect(r.data.last_used_at > '2020-01-02').toBe(true)
  })

  it('deleting a folder keeps its sets with folder_id null', async () => {
    const f = (await call<Folder>('POST', '/api/folders', { name: 'f' })).data
    const s = await makeSet('kept', f.id)
    const before = (await call<SetWithCards>('GET', `/api/sets/${s.id}`)).data
    expect(before.folder).toEqual({ id: f.id, name: 'f' })
    expect((await call('DELETE', `/api/folders/${f.id}`)).status).toBe(204)
    const after = (await call<SetWithCards>('GET', `/api/sets/${s.id}`)).data
    expect(after.folder_id).toBeNull()
    expect(after.folder).toBeNull()
    expect((await call('GET', `/api/folders/${f.id}`)).status).toBe(404)
  })
})

describe('sets', () => {
  it('rejects a folder that does not exist', async () => {
    expect((await call('POST', '/api/sets', { title: 't', folder_id: 999 })).status).toBe(404)
  })

  it('filters by folder and by none', async () => {
    const f = (await call<Folder>('POST', '/api/folders', { name: 'f' })).data
    await makeSet('in', f.id)
    await makeSet('loose')
    const inFolder = (await call<CardSet[]>('GET', `/api/sets?folder=${f.id}`)).data
    expect(inFolder.map((s) => s.title)).toEqual(['in'])
    const loose = (await call<CardSet[]>('GET', '/api/sets?folder=none')).data
    expect(loose.map((s) => s.title)).toEqual(['loose'])
  })

  it('patches title, folder, and code mode; rejects an empty patch', async () => {
    const f = (await call<Folder>('POST', '/api/folders', { name: 'f' })).data
    const s = await makeSet('old')
    const r = await call<CardSet>('PATCH', `/api/sets/${s.id}`, { title: 'new', folder_id: f.id, code_mode: true })
    expect(r.data).toMatchObject({ title: 'new', folder_id: f.id, code_mode: 1 })
    const moved = await call<CardSet>('PATCH', `/api/sets/${s.id}`, { folder_id: null })
    expect(moved.data.folder_id).toBeNull()
    expect((await call('PATCH', `/api/sets/${s.id}`, {})).status).toBe(400)
  })

  it('deleting a set deletes its cards', async () => {
    const s = await makeSet('s')
    const withCards = await putCards(s.id, [{ term: 'a', definition: 'b' }])
    const cardId = withCards.cards[0].id
    expect((await call('DELETE', `/api/sets/${s.id}`)).status).toBe(204)
    expect((await call('PATCH', `/api/cards/${cardId}`, { starred: true })).status).toBe(404)
  })
})

describe('card replace', () => {
  it('inserts, updates in place, deletes, and sets positions', async () => {
    const s = await makeSet('s')
    const first = await putCards(s.id, [
      { term: 'a', definition: '1' },
      { term: 'b', definition: '2' },
      { term: 'c', definition: '3' },
    ])
    expect(first.cards.map((c) => c.position)).toEqual([0, 1, 2])
    const [a, b, c] = first.cards

    // Star and sort b so we can check they survive the replace.
    await call('PATCH', `/api/cards/${b.id}`, { starred: true })
    await call('POST', `/api/cards/${b.id}/sort`, { checked: true })

    // Reorder: c, b (edited), new d. a is dropped.
    const second = await putCards(s.id, [
      { id: c.id, term: 'c', definition: '3' },
      { id: b.id, term: 'B', definition: '2' },
      { term: 'd', definition: '4' },
    ])
    expect(second.cards.map((x) => [x.term, x.position])).toEqual([
      ['c', 0],
      ['B', 1],
      ['d', 2],
    ])
    const bAfter = second.cards[1]
    expect(bAfter.id).toBe(b.id)
    expect(bAfter.starred).toBe(1)
    expect(bAfter.sorted_count).toBe(1)
    expect(bAfter.checked_count).toBe(1)
    expect((await call('PATCH', `/api/cards/${a.id}`, { starred: true })).status).toBe(404)
    expect(second.updated_at >= s.updated_at).toBe(true)
  })

  it('rejects a card id from another set and leaves the set unchanged', async () => {
    const s1 = await makeSet('one')
    const s2 = await makeSet('two')
    const other = (await putCards(s2.id, [{ term: 'x', definition: 'y' }])).cards[0]
    await putCards(s1.id, [{ term: 'keep', definition: '' }])
    const r = await call('PUT', `/api/sets/${s1.id}/cards`, [{ term: 'new', definition: '' }, { id: other.id, term: 'x', definition: 'y' }])
    expect(r.status).toBe(400)
    const after = (await call<SetWithCards>('GET', `/api/sets/${s1.id}`)).data
    expect(after.cards.map((c) => c.term)).toEqual(['keep'])
  })

  it('rejects an image id that does not exist', async () => {
    const s = await makeSet('s')
    const r = await call('PUT', `/api/sets/${s.id}/cards`, [{ term: 'a', definition: '', term_image_id: 42 }])
    expect(r.status).toBe(400)
  })

  it('rejects the same card id twice', async () => {
    const s = await makeSet('s')
    const card = (await putCards(s.id, [{ term: 'a', definition: '' }])).cards[0]
    const r = await call('PUT', `/api/sets/${s.id}/cards`, [
      { id: card.id, term: 'x', definition: '' },
      { id: card.id, term: 'y', definition: '' },
    ])
    expect(r.status).toBe(400)
    const after = (await call<SetWithCards>('GET', `/api/sets/${s.id}`)).data
    expect(after.cards.map((c) => [c.term, c.position])).toEqual([['a', 0]])
  })

  it('an empty list clears the set', async () => {
    const s = await makeSet('s')
    await putCards(s.id, [{ term: 'a', definition: '' }])
    const cleared = await putCards(s.id, [])
    expect(cleared.cards).toEqual([])
  })
})

describe('card sort counters', () => {
  it('counts checked and X, and undo reverses the last update', async () => {
    const s = await makeSet('s')
    const card = (await putCards(s.id, [{ term: 'a', definition: '' }])).cards[0]
    const sort = (checked: boolean, undo = false) => call<Card>('POST', `/api/cards/${card.id}/sort`, { checked, undo })

    expect((await sort(true)).data).toMatchObject({ sorted_count: 1, checked_count: 1 })
    expect((await sort(false)).data).toMatchObject({ sorted_count: 2, checked_count: 1 })
    expect((await sort(false, true)).data).toMatchObject({ sorted_count: 1, checked_count: 1 })
    expect((await sort(true, true)).data).toMatchObject({ sorted_count: 0, checked_count: 0 })
    expect((await sort(true, true)).status).toBe(400)
  })

  it('rejects an undo that would put checked above sorted', async () => {
    const s = await makeSet('s')
    const card = (await putCards(s.id, [{ term: 'a', definition: '' }])).cards[0]
    await call('POST', `/api/cards/${card.id}/sort`, { checked: true })
    const r = await call<Card>('POST', `/api/cards/${card.id}/sort`, { checked: false, undo: true })
    expect(r.status).toBe(400)
  })

  it('rejects a non-boolean checked', async () => {
    const s = await makeSet('s')
    const card = (await putCards(s.id, [{ term: 'a', definition: '' }])).cards[0]
    expect((await call('POST', `/api/cards/${card.id}/sort`, { checked: 'yes' })).status).toBe(400)
  })
})

describe('images', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  )

  it('stores a png under its row id and serves it', async () => {
    const form = new FormData()
    form.append('file', new Blob([png], { type: 'image/png' }), 'dot.png')
    const r = await call<Image & { url: string }>('POST', '/api/images', form)
    expect(r.status).toBe(201)
    expect(r.data.file).toBe(`${r.data.id}.png`)
    expect(r.data.url).toBe(`/images/${r.data.id}.png`)
    expect(existsSync(join(dir, 'images', r.data.file))).toBe(true)
    const served = await fetch(base + r.data.url)
    expect(served.status).toBe(200)
    expect(Buffer.from(await served.arrayBuffer()).equals(png)).toBe(true)
  })

  it('rejects a non-image type', async () => {
    const form = new FormData()
    form.append('file', new Blob(['hello'], { type: 'text/plain' }), 'a.txt')
    expect((await call('POST', '/api/images', form)).status).toBe(400)
  })

  it('a card can point at a stored image', async () => {
    const form = new FormData()
    form.append('file', new Blob([png], { type: 'image/png' }), 'dot.png')
    const img = (await call<Image>('POST', '/api/images', form)).data
    const s = await makeSet('s')
    const withImage = await putCards(s.id, [{ term: 'a', definition: '', term_image_id: img.id }])
    expect(withImage.cards[0].term_image_id).toBe(img.id)
    expect(withImage.cards[0].term_image_url).toBe(`/images/${img.file}`)
    expect(withImage.cards[0].definition_image_url).toBeNull()
  })
})

describe('orphan image sweep', () => {
  it('removes old unreferenced images and keeps referenced or recent ones', async () => {
    const upload = async () => {
      const form = new FormData()
      form.append('file', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'x.png')
      return (await call<Image>('POST', '/api/images', form)).data
    }
    const used = await upload()
    const oldOrphan = await upload()
    const recentOrphan = await upload()
    const s = await makeSet('s')
    await putCards(s.id, [{ term: 'a', definition: '', term_image_id: used.id }])
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    setClock('images', used.id, 'created_at', twoDaysAgo)
    setClock('images', oldOrphan.id, 'created_at', twoDaysAgo)

    const removed = await sweepOrphanImages(db, join(dir, 'images'))
    expect(removed).toBe(1)
    const left = db.prepare('SELECT id FROM images ORDER BY id').all() as { id: number }[]
    expect(left.map((r) => r.id)).toEqual([used.id, recentOrphan.id])
    expect(existsSync(join(dir, 'images', oldOrphan.file))).toBe(false)
    expect(existsSync(join(dir, 'images', used.file))).toBe(true)
  })
})
