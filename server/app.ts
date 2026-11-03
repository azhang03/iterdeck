import express, { type ErrorRequestHandler } from 'express'
import { MulterError } from 'multer'
import type { Db } from './db.ts'
import { cardsRouter } from './routes/cards.ts'
import { foldersRouter } from './routes/folders.ts'
import { imagesRouter } from './routes/images.ts'
import { filesRouter } from './routes/files.ts'
import { setsRouter } from './routes/sets.ts'

export type Dirs = { imagesDir: string; filesDir: string }

export function createApp(db: Db, dirs: Dirs) {
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use('/api/folders', foldersRouter(db))
  app.use('/api/sets', setsRouter(db, dirs))
  app.use('/api/sets/:id/files', filesRouter(db, dirs.filesDir))
  app.use('/api/cards', cardsRouter(db))
  app.use('/api/images', imagesRouter(db, dirs.imagesDir))
  app.use('/images', express.static(dirs.imagesDir))
  app.use('/files', express.static(dirs.filesDir))

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'route not found' })
  })

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof MulterError) {
      res.status(400).json({ error: err.message })
      return
    }
    const status = typeof err.status === 'number' ? err.status : 500
    if (status === 500) console.error(err)
    res.status(status).json({ error: status === 500 ? 'internal error' : err.message })
  }
  app.use(onError)

  return app
}
