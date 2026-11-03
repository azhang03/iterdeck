import { Router } from 'express'
import multer from 'multer'
import { rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { Db } from '../db.ts'
import { now } from '../db.ts'
import type { SetFile } from '../../shared/types.ts'
import { BadRequest, NotFound, id } from '../validate.ts'
import { inspectCsv, tableName } from '../csv.ts'
import { getSet } from './sets.ts'

const MAX_BYTES = 5 * 1024 * 1024

type FileRow = Omit<SetFile, 'columns'> & { columns: string }

function parseRow(row: FileRow): SetFile {
  return { ...row, columns: JSON.parse(row.columns) }
}

export function listFiles(db: Db, setId: number): SetFile[] {
  const rows = db.prepare('SELECT * FROM set_files WHERE set_id = ? ORDER BY table_name').all(setId) as FileRow[]
  return rows.map(parseRow)
}

// Mounted at /api/sets/:id/files. mergeParams gives the handlers the set id;
// the handler generics name it because the Router type cannot see the mount path.
type SetParams = { id: string }

export function filesRouter(db: Db, filesDir: string) {
  const r = Router({ mergeParams: true })
  // Browsers send text/csv or application/vnd.ms-excel for a CSV, so the
  // extension decides, not the mimetype.
  const upload = multer({
    dest: filesDir,
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (/\.csv$/i.test(file.originalname)) cb(null, true)
      else cb(new BadRequest('only .csv files'))
    },
  })
  r.get<'/', SetParams>('/', (req, res) => {
    const setId = id(req.params.id, 'id')
    getSet(db, setId)
    res.json(listFiles(db, setId))
  })

  // multer writes to a temp name in filesDir; the row id then gives the final name.
  // On any failure, the row (when inserted) and the temp file are removed again.
  r.post<'/', SetParams>('/', upload.single('file'), async (req, res) => {
    const setId = id(req.params.id, 'id')
    if (!req.file) throw new BadRequest('file is required')
    const temp = req.file.path
    const name = tableName(req.file.originalname)
    let fileId: number
    try {
      getSet(db, setId)
      const exists = db.prepare('SELECT 1 FROM set_files WHERE set_id = ? AND table_name = ?').get(setId, name)
      if (exists) throw new BadRequest(`a table named ${name} already exists in this set`)
      const info = await inspectCsv(temp)
      const result = db
        .prepare(
          'INSERT INTO set_files (set_id, table_name, file, columns, row_count, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(setId, name, '', JSON.stringify(info.columns), info.row_count, req.file.size, now())
      fileId = Number(result.lastInsertRowid)
    } catch (err) {
      await unlink(temp).catch(() => {})
      // A second upload of the same name that passed the check during inspectCsv.
      if (isUniqueViolation(err)) throw new BadRequest(`a table named ${name} already exists in this set`)
      throw err
    }
    const file = `${fileId}.csv`
    try {
      await rename(temp, join(filesDir, file))
      db.prepare('UPDATE set_files SET file = ? WHERE id = ?').run(file, fileId)
    } catch (err) {
      db.prepare('DELETE FROM set_files WHERE id = ?').run(fileId)
      await unlink(temp).catch(() => {})
      throw err
    }
    const row = db.prepare('SELECT * FROM set_files WHERE id = ?').get(fileId) as FileRow
    res.status(201).json(parseRow(row))
  })
  r.delete<'/:fileId', SetParams & { fileId: string }>('/:fileId', async (req, res) => {
    const setId = id(req.params.id, 'id')
    const fileId = id(req.params.fileId, 'fileId')
    const row = db.prepare('SELECT * FROM set_files WHERE id = ? AND set_id = ?').get(fileId, setId) as FileRow | undefined
    if (!row) throw new NotFound('file')
    db.prepare('DELETE FROM set_files WHERE id = ?').run(fileId)
    await unlink(join(filesDir, row.file)).catch(() => {})
    res.status(204).end()
  })

  return r
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && 'code' in err && err.code === 'SQLITE_CONSTRAINT_UNIQUE'
}
