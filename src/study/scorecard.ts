// What a scorecard needs besides the session state: a short name for a card,
// and the count of a card's test run.

// The last test run of a card: how many cases passed, of how many.
export type TestTally = { passed: number; total: number }

const HEADING = /^#{1,6}\s+/

// Removes the markdown marks of one line: heading marks, bold and italic stars,
// code ticks, and the URL of a link. Underscores stay: in these cards they are
// part of names such as two_sum far more often than they are emphasis.
function plain(line: string): string {
  return line
    .replace(HEADING, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|`/g, '')
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, '$1')
    .trim()
}

// A short name for a card in a list: the first line of its text, and the first
// heading under it when there is one. Cards of one interview question share the
// first line; the heading ("Follow-up 1: ...") tells them apart.
export function cardLabel(text: string): string {
  // Lines of a fenced code block are not text: a `# comment` in Python is no heading.
  let fenced = false
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      const fence = l.startsWith('```')
      if (fence) fenced = !fenced
      return l !== '' && !fence && !fenced
    })
  if (lines.length === 0) return '(empty)'
  const title = plain(lines[0])
  const heading = lines.slice(1).find((l) => HEADING.test(l))
  return heading ? `${title} \u00b7 ${plain(heading)}` : title
}

// The sum of the measured times, and how many of the cards have one. A card of a
// session from before the scorecard has no time.
export function timeOf(rows: { ms: number | null }[]): { total: number; count: number } {
  const timed = rows.flatMap((r) => (r.ms === null ? [] : [r.ms]))
  return { total: timed.reduce((sum, ms) => sum + ms, 0), count: timed.length }
}

// The time on each card, added over every time it was shown. A card with no
// measured time is not in the map.
export function timeByCard(results: { cardId: number; ms?: number }[]): Map<number, number> {
  const times = new Map<number, number>()
  for (const r of results) if (r.ms !== undefined) times.set(r.cardId, (times.get(r.cardId) ?? 0) + r.ms)
  return times
}

// How many of the cards whose tests were run had every case pass.
export function testsPassed(tallies: (TestTally | null)[]): { passed: number; ran: number } {
  const ran = tallies.flatMap((t) => (t ? [t] : []))
  return { passed: ran.filter((t) => t.passed === t.total).length, ran: ran.length }
}

// The tallies travel with the saved snapshot of a study session, under `tallies`,
// so a card's test result is still there when the user comes back to the session.
// Reads them back; an entry with a wrong shape is left out.
export function savedTallies(saved: unknown): Record<number, TestTally> {
  const out: Record<number, TestTally> = {}
  if (typeof saved !== 'object' || saved === null || !('tallies' in saved)) return out
  const { tallies } = saved
  if (typeof tallies !== 'object' || tallies === null) return out
  for (const [cardId, tally] of Object.entries(tallies)) {
    if (typeof tally !== 'object' || tally === null || !('passed' in tally) || !('total' in tally)) continue
    const { passed, total } = tally
    if (Number.isInteger(Number(cardId)) && typeof passed === 'number' && typeof total === 'number') out[Number(cardId)] = { passed, total }
  }
  return out
}
