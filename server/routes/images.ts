import { Router } from 'express'
import multer from 'multer'
import { rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { Db } from '../db.ts'
import { now } from '../db.ts'
import type { Image } from '../../shared/types.ts'
import { BadRequest } from '../validate.ts'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const MAX_BYTES = 10 * 1024 * 1024

export function imagesRouter(db: Db, imagesDir: string) {
  const r = Router()
  const upload = multer({
    dest: imagesDir,
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (EXT[file.mimetype]) cb(null, true)
      else cb(new BadRequest(`unsupported image type ${file.mimetype}`))
    },
  })

  // multer writes to a temp name in imagesDir; the row id then gives the final name.
  // On any failure after the insert, the row and the temp file are removed again.
  r.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) throw new BadRequest('file is required')
    const ext = EXT[req.file.mimetype]
    const info = db.prepare('INSERT INTO images (file, mime, created_at) VALUES (?, ?, ?)').run('', req.file.mimetype, now())
    const imageId = Number(info.lastInsertRowid)
    const file = `${imageId}.${ext}`
    try {
      await rename(req.file.path, join(imagesDir, file))
      db.prepare('UPDATE images SET file = ? WHERE id = ?').run(file, imageId)
    } catch (err) {
      db.prepare('DELETE FROM images WHERE id = ?').run(imageId)
      await unlink(req.file.path).catch(() => {})
      throw err
    }
    const row = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId) as Image
    res.status(201).json({ ...row, url: `/images/${file}` })
  })

  return r
}
