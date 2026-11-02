import { join } from 'node:path'
import { createApp } from './app.ts'
import { openDb } from './db.ts'
import { DATA_DIR } from './paths.ts'

const db = openDb(join(DATA_DIR, 'iterdeck.db'))
const app = createApp(db, join(DATA_DIR, 'images'))

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`API on http://localhost:${port}, data in ${DATA_DIR}`)
})
