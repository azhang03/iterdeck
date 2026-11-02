import express from 'express'
import { DATA_DIR } from './paths.ts'

const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/images', express.static(`${DATA_DIR}/images`))

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`API on http://localhost:${port}, data in ${DATA_DIR}`)
})
