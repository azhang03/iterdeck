import { Router } from 'express'
import type { Db } from '../db.ts'
import { now } from '../db.ts'
import type { Card, CardInput, CardSet, SetWithCards, StudyMode, StudyProgress } from '../../shared/types.ts'
import { BadRequest, NotFound, bool, id, idOrNull, language, listSort, nonEmptyText, orderBy, query, studyMode, text } from '../validate.ts'
import { getFolder, like } from './folders.ts'
import { sweepOrphanImages } from '../images.ts'
import { listFiles } from './files.ts'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

export function setsRouter(db: Db, dirs: { imagesDir: string; filesDir: string }) {
  const r = Router()

  r.get('/', (req, res) => {
    const sort = listSort(req.query.sort)
    const q = query(req.query.q)
    const folder = req.query.folder
    let where = `title LIKE ? ESCAPE '\\'`
    const params: unknown[] = [like(q)]
    if (folder === 'none') {
      where += ' AND folder_id IS NULL'
    } else if (folder !== undefined) {
      where += ' AND folder_id = ?'
      params.push(id(folder, 'folder'))
    }
    const rows = db.prepare(`SELECT * FROM sets WHERE ${where} ORDER BY ${orderBy(sort, 'title')}`).all(...params) as CardSet[]
    res.json(rows)
  })

  r.post('/', (req, res) => {
    const title = nonEmptyText(req.body?.title, 'title')
    const folderId = idOrNull(req.body?.folder_id, 'folder_id')
    if (folderId !== null) getFolder(db, folderId)
    const t = now()
    const info = db
      .prepare('INSERT INTO sets (title, folder_id, code_mode, created_at, updated_at, last_used_at) VALUES (?, ?, 0, ?, ?, ?)')
      .run(title, folderId, t, t, t)
    res.status(201).json(getSet(db, Number(info.lastInsertRowid)))
  })

  r.get('/:id', (req, res) => {
    res.json(setWithCards(db, id(req.params.id, 'id')))
  })

  r.post('/:id/open', (req, res) => {
    const setId = id(req.params.id, 'id')
    getSet(db, setId)
    db.prepare('UPDATE sets SET last_used_at = ? WHERE id = ?').run(now(), setId)
    res.json(getSet(db, setId))
  })

  r.patch('/:id', (req, res) => {
    const setId = id(req.params.id, 'id')
    getSet(db, setId)
    const body = req.body ?? {}
    const fields: string[] = []
    const params: unknown[] = []
    if (body.title !== undefined) {
      fields.push('title = ?')
      params.push(nonEmptyText(body.title, 'title'))
    }
    if (body.folder_id !== undefined) {
      const folderId = idOrNull(body.folder_id, 'folder_id')
      if (folderId !== null) getFolder(db, folderId)
      fields.push('folder_id = ?')
      params.push(folderId)
    }
    if (body.code_mode !== undefined) {
      fields.push('code_mode = ?')
      params.push(bool(body.code_mode, 'code_mode'))
    }
    if (body.language !== undefined) {
      fields.push('language = ?')
      params.push(language(body.language))
    }
    if (fields.length === 0) throw new BadRequest('nothing to update')
    fields.push('updated_at = ?')
    params.push(now(), setId)
    db.prepare(`UPDATE sets SET ${fields.join(', ')} WHERE id = ?`).run(...params)
    res.json(getSet(db, setId))
  })

  r.put('/:id/cards', (req, res) => {
    const setId = id(req.params.id, 'id')
    getSet(db, setId)
    if (!Array.isArray(req.body)) throw new BadRequest('body must be an array of cards')
    const inputs = req.body.map(cardInput)
    replaceCards(db, setId, inputs)
    res.json(setWithCards(db, setId))
    void sweepOrphanImages(db, dirs.imagesDir)
  })

  // A study session's position. The body is the client's snapshot, stored as is.
  r.put('/:id/progress/:mode', (req, res) => {
    const setId = id(req.params.id, 'id')
    const mode = studyMode(req.params.mode)
    getSet(db, setId)
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) throw new BadRequest('body must be an object')
    const state = JSON.stringify(req.body)
    if (state.length > MAX_PROGRESS_CHARS) throw new BadRequest('progress is too large')
    db.prepare(
      'INSERT INTO study_progress (set_id, mode, state, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (set_id, mode) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at',
    ).run(setId, mode, state, now())
    res.status(204).end()
  })

  r.delete('/:id/progress/:mode', (req, res) => {
    const setId = id(req.params.id, 'id')
    const mode = studyMode(req.params.mode)
    getSet(db, setId)
    db.prepare('DELETE FROM study_progress WHERE set_id = ? AND mode = ?').run(setId, mode)
    res.status(204).end()
  })

  // Restart in a study mode: the code written for every card goes.
  r.delete('/:id/code', (req, res) => {
    const setId = id(req.params.id, 'id')
    getSet(db, setId)
    db.prepare("UPDATE cards SET code = '' WHERE set_id = ?").run(setId)
    res.status(204).end()
  })

  r.delete('/:id', async (req, res) => {
    const setId = id(req.params.id, 'id')
    getSet(db, setId)
    const files = db.prepare('SELECT file FROM set_files WHERE set_id = ?').all(setId) as { file: string }[]
    // cards.set_id and set_files.set_id are ON DELETE CASCADE.
    db.prepare('DELETE FROM sets WHERE id = ?').run(setId)
    for (const f of files) await unlink(join(dirs.filesDir, f.file)).catch(() => {})
    res.status(204).end()
  })

  return r
}

export function getSet(db: Db, setId: number): CardSet {
  const row = db.prepare('SELECT * FROM sets WHERE id = ?').get(setId) as CardSet | undefined
  if (!row) throw new NotFound('set')
  return row
}

// Card rows with the image URLs joined in, so the client can show thumbnails.
const CARD_SELECT = `
  SELECT c.*,
    CASE WHEN ti.file IS NULL THEN NULL ELSE '/images/' || ti.file END AS term_image_url,
    CASE WHEN di.file IS NULL THEN NULL ELSE '/images/' || di.file END AS definition_image_url
  FROM cards c
  LEFT JOIN images ti ON ti.id = c.term_image_id
  LEFT JOIN images di ON di.id = c.definition_image_id`

export function getCards(db: Db, setId: number): Card[] {
  return db.prepare(`${CARD_SELECT} WHERE c.set_id = ? ORDER BY c.position, c.id`).all(setId) as Card[]
}

// The set, the folder it is in (id and name, or null), its cards, its CSV files,
// and the saved study progress per mode.
function setWithCards(db: Db, setId: number): SetWithCards {
  const set = getSet(db, setId)
  const folder =
    set.folder_id === null
      ? null
      : ((db.prepare('SELECT id, name FROM folders WHERE id = ?').get(set.folder_id) as SetWithCards['folder']) ?? null)
  return { ...set, folder, cards: getCards(db, setId), files: listFiles(db, setId), progress: getProgress(db, setId) }
}

const MAX_PROGRESS_CHARS = 100000

function getProgress(db: Db, setId: number): StudyProgress {
  const rows = db.prepare('SELECT mode, state FROM study_progress WHERE set_id = ?').all(setId) as { mode: StudyMode; state: string }[]
  const progress: StudyProgress = { flashcards: null, learn: null }
  for (const row of rows) progress[row.mode] = JSON.parse(row.state)
  return progress
}

export function getCard(db: Db, cardId: number): Card | undefined {
  return db.prepare(`${CARD_SELECT} WHERE c.id = ?`).get(cardId) as Card | undefined
}

function cardInput(v: unknown, index: number): CardInput {
  if (typeof v !== 'object' || v === null) throw new BadRequest(`card ${index} must be an object`)
  const c = v as Record<string, unknown>
  return {
    id: c.id === undefined || c.id === null ? undefined : id(c.id, `card ${index} id`),
    term: text(c.term ?? '', `card ${index} term`),
    definition: text(c.definition ?? '', `card ${index} definition`),
    term_image_id: idOrNull(c.term_image_id, `card ${index} term_image_id`),
    definition_image_id: idOrNull(c.definition_image_id, `card ${index} definition_image_id`),
    tests: text(c.tests ?? '', `card ${index} tests`, 20000),
    ordered: c.ordered === undefined ? false : bool(c.ordered, `card ${index} ordered`) === 1,
  }
}

// Replaces the set's card list in one transaction. Cards with an id are updated in
// place and keep their stars and stats. Cards without an id are inserted. Cards of
// the set that are not in the list are deleted. Position is the array index.
function replaceCards(db: Db, setId: number, inputs: CardInput[]) {
  const update = db.prepare(
    'UPDATE cards SET position = ?, term = ?, definition = ?, term_image_id = ?, definition_image_id = ?, tests = ?, ordered = ? WHERE id = ? AND set_id = ?',
  )
  const insert = db.prepare(
    'INSERT INTO cards (set_id, position, term, definition, term_image_id, definition_image_id, tests, ordered, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  const imageExists = db.prepare('SELECT 1 FROM images WHERE id = ?')
  db.transaction(() => {
    const t = now()
    const keep: number[] = []
    inputs.forEach((c, position) => {
      for (const imageId of [c.term_image_id, c.definition_image_id]) {
        if (imageId !== null && !imageExists.get(imageId)) throw new BadRequest(`card ${position}: image ${imageId} not found`)
      }
      if (c.id !== undefined) {
        if (keep.includes(c.id)) throw new BadRequest(`card ${position}: card ${c.id} is listed twice`)
        const changed = update.run(position, c.term, c.definition, c.term_image_id, c.definition_image_id, c.tests, c.ordered ? 1 : 0, c.id, setId).changes
        if (changed === 0) throw new BadRequest(`card ${position}: card ${c.id} is not in this set`)
        keep.push(c.id)
      } else {
        const info = insert.run(setId, position, c.term, c.definition, c.term_image_id, c.definition_image_id, c.tests, c.ordered ? 1 : 0, t)
        keep.push(Number(info.lastInsertRowid))
      }
    })
    const marks = keep.map(() => '?').join(', ')
    db.prepare(`DELETE FROM cards WHERE set_id = ? ${keep.length ? `AND id NOT IN (${marks})` : ''}`).run(setId, ...keep)
    db.prepare('UPDATE sets SET updated_at = ? WHERE id = ?').run(t, setId)
  })()
}
