import { Router } from 'express'
import type { Db } from '../db.ts'
import { now } from '../db.ts'
import type { CardSet, Folder } from '../../shared/types.ts'
import { NotFound, id, listSort, nonEmptyText, orderBy, query } from '../validate.ts'

export function foldersRouter(db: Db) {
  const r = Router()

  r.get('/', (req, res) => {
    const sort = listSort(req.query.sort)
    const q = query(req.query.q)
    const rows = db
      .prepare(`SELECT * FROM folders WHERE name LIKE ? ESCAPE '\\' ORDER BY ${orderBy(sort, 'name')}`)
      .all(like(q)) as Folder[]
    res.json(rows)
  })

  r.post('/', (req, res) => {
    const name = nonEmptyText(req.body?.name, 'name')
    const t = now()
    const info = db.prepare('INSERT INTO folders (name, created_at, last_used_at) VALUES (?, ?, ?)').run(name, t, t)
    res.status(201).json(getFolder(db, Number(info.lastInsertRowid)))
  })

  r.get('/:id', (req, res) => {
    const folderId = id(req.params.id, 'id')
    getFolder(db, folderId)
    db.prepare('UPDATE folders SET last_used_at = ? WHERE id = ?').run(now(), folderId)
    const folder = getFolder(db, folderId)
    const sort = listSort(req.query.sort)
    const q = query(req.query.q)
    const sets = db
      .prepare(`SELECT * FROM sets WHERE folder_id = ? AND title LIKE ? ESCAPE '\\' ORDER BY ${orderBy(sort, 'title')}`)
      .all(folderId, like(q)) as CardSet[]
    res.json({ ...folder, sets })
  })

  r.patch('/:id', (req, res) => {
    const folderId = id(req.params.id, 'id')
    getFolder(db, folderId)
    const name = nonEmptyText(req.body?.name, 'name')
    db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, folderId)
    res.json(getFolder(db, folderId))
  })

  r.delete('/:id', (req, res) => {
    const folderId = id(req.params.id, 'id')
    getFolder(db, folderId)
    // sets.folder_id is ON DELETE SET NULL, so the sets stay.
    db.prepare('DELETE FROM folders WHERE id = ?').run(folderId)
    res.status(204).end()
  })

  return r
}

export function getFolder(db: Db, folderId: number): Folder {
  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId) as Folder | undefined
  if (!row) throw new NotFound('folder')
  return row
}

// Pattern for a LIKE substring match. Escapes the LIKE wildcards in the user's text.
export function like(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}
