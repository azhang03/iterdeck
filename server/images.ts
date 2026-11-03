import { readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { Db } from './db.ts'
import type { Image } from '../shared/types.ts'

const GRACE_MS = 24 * 60 * 60 * 1000

// Deletes images that no card references and that are older than one day.
// The grace period keeps images that the editor uploaded but has not saved yet.
// Runs at startup and after each card list save.
export async function sweepOrphanImages(db: Db, imagesDir: string, now = Date.now()): Promise<number> {
  const cutoff = new Date(now - GRACE_MS).toISOString()
  const orphans = db
    .prepare(
      `SELECT * FROM images i
       WHERE i.created_at < ?
         AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.term_image_id = i.id OR c.definition_image_id = i.id)`,
    )
    .all(cutoff) as Image[]
  const remove = db.prepare('DELETE FROM images WHERE id = ?')
  for (const img of orphans) {
    remove.run(img.id)
    await unlink(join(imagesDir, img.file)).catch(() => {})
  }
  return orphans.length
}

// Deletes CSV files in filesDir that no set_files row names and that are older
// than one day. These are left by uploads that failed after multer wrote the file.
export async function sweepOrphanFiles(db: Db, filesDir: string, now = Date.now()): Promise<number> {
  const known = new Set((db.prepare('SELECT file FROM set_files').all() as { file: string }[]).map((r) => r.file))
  const names = await readdir(filesDir).catch(() => [] as string[])
  let removed = 0
  for (const name of names) {
    if (known.has(name)) continue
    const path = join(filesDir, name)
    const info = await stat(path).catch(() => null)
    if (!info || info.mtimeMs > now - GRACE_MS) continue
    await unlink(path).catch(() => {})
    removed++
  }
  return removed
}
