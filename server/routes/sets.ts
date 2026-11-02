import { Router } from 'express'
import type { Db } from '../db.ts'
import { now } from '../db.ts'
import type { Card, CardInput, CardSet } from '../../shared/types.ts'
import { BadRequest, NotFound, bool, id, idOrNull, listSort, nonEmptyText, orderBy, query, text } from '../validate.ts'
import { getFolder, like } from './folders.ts'

export function setsRouter(db: Db) {
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
    const setId = id(req.params.id, 'id')
    const set = getSet(db, setId)
    res.json({ ...set, cards: getCards(db, setId) })
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
    res.json({ ...getSet(db, setId), cards: getCards(db, setId) })
  })

  r.delete('/:id', (req, res) => {
    const setId = id(req.params.id, 'id')
    getSet(db, setId)
    // cards.set_id is ON DELETE CASCADE.
    db.prepare('DELETE FROM sets WHERE id = ?').run(setId)
    res.status(204).end()
  })

  return r
}

export function getSet(db: Db, setId: number): CardSet {
  const row = db.prepare('SELECT * FROM sets WHERE id = ?').get(setId) as CardSet | undefined
  if (!row) throw new NotFound('set')
  return row
}

export function getCards(db: Db, setId: number): Card[] {
  return db.prepare('SELECT * FROM cards WHERE set_id = ? ORDER BY position, id').all(setId) as Card[]
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
  }
}

// Replaces the set's card list in one transaction. Cards with an id are updated in
// place and keep their stars and stats. Cards without an id are inserted. Cards of
// the set that are not in the list are deleted. Position is the array index.
function replaceCards(db: Db, setId: number, inputs: CardInput[]) {
  const update = db.prepare(
    'UPDATE cards SET position = ?, term = ?, definition = ?, term_image_id = ?, definition_image_id = ? WHERE id = ? AND set_id = ?',
  )
  const insert = db.prepare(
    'INSERT INTO cards (set_id, position, term, definition, term_image_id, definition_image_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
        const changed = update.run(position, c.term, c.definition, c.term_image_id, c.definition_image_id, c.id, setId).changes
        if (changed === 0) throw new BadRequest(`card ${position}: card ${c.id} is not in this set`)
        keep.push(c.id)
      } else {
        const info = insert.run(setId, position, c.term, c.definition, c.term_image_id, c.definition_image_id, t)
        keep.push(Number(info.lastInsertRowid))
      }
    })
    const marks = keep.map(() => '?').join(', ')
    db.prepare(`DELETE FROM cards WHERE set_id = ? ${keep.length ? `AND id NOT IN (${marks})` : ''}`).run(setId, ...keep)
    db.prepare('UPDATE sets SET updated_at = ? WHERE id = ?').run(t, setId)
  })()
}
