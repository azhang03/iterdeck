import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// All user data lives in data/ at the repo root. It is git-ignored.
export const DATA_DIR = process.env.ITERDECK_DATA ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data')

mkdirSync(`${DATA_DIR}/images`, { recursive: true })
