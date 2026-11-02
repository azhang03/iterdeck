import { Router } from 'express'
import type { Db } from '../db.ts'
import type { Card } from '../../shared/types.ts'
import { BadRequest, NotFound, bool, id, text } from '../validate.ts'
import { getCard as findCard } from './sets.ts'

export function cardsRouter(db: Db) {
  const r = Router()

  r.patch('/:id', (req, res) => {
    const cardId = id(req.params.id, 'id')
    getCard(db, cardId)
    const body = req.body ?? {}
    const fields: string[] = []
    const params: unknown[] = []
    if (body.term !== undefined) {
      fields.push('term = ?')
      params.push(text(body.term, 'term'))
    }
    if (body.definition !== undefined) {
      fields.push('definition = ?')
      params.push(text(body.definition, 'definition'))
    }
    if (body.starred !== undefined) {
      fields.push('starred = ?')
      params.push(bool(body.starred, 'starred'))
    }
    if (fields.length === 0) throw new BadRequest('nothing to update')
    params.push(cardId)
    db.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...params)
    res.json(getCard(db, cardId))
  })

  // A Flashcards result. Adds one sort, and one check when checked. With undo, subtracts instead.
  r.post('/:id/sort', (req, res) => {
    const cardId = id(req.params.id, 'id')
    const card = getCard(db, cardId)
    const checked = bool(req.body?.checked, 'checked')
    const undo = req.body?.undo === undefined ? 0 : bool(req.body.undo, 'undo')
    const delta = undo ? -1 : 1
    const sorted = card.sorted_count + delta
    const checkedCount = card.checked_count + (checked ? delta : 0)
    if (sorted < 0 || checkedCount < 0 || checkedCount > sorted) throw new BadRequest('nothing to undo')
    db.prepare('UPDATE cards SET sorted_count = ?, checked_count = ? WHERE id = ?').run(sorted, checkedCount, cardId)
    res.json(getCard(db, cardId))
  })

  return r
}

function getCard(db: Db, cardId: number): Card {
  const row = findCard(db, cardId)
  if (!row) throw new NotFound('card')
  return row
}
