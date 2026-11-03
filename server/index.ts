import { join } from 'node:path'
import { createApp } from './app.ts'
import { openDb } from './db.ts'
import { sweepOrphanFiles, sweepOrphanImages } from './images.ts'
import { DATA_DIR } from './paths.ts'

const dirs = { imagesDir: join(DATA_DIR, 'images'), filesDir: join(DATA_DIR, 'files') }
const db = openDb(join(DATA_DIR, 'iterdeck.db'))
const app = createApp(db, dirs)
void sweepOrphanImages(db, dirs.imagesDir)
void sweepOrphanFiles(db, dirs.filesDir)

const port = Number(process.env.PORT ?? 3001)
app.listen(port, (err) => {
  if (err) throw err
  console.log(`API on http://localhost:${port}, data in ${DATA_DIR}`)
})
