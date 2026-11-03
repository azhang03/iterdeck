import { loadPyodide } from 'pyodide'
import { createSession, type Session } from './pyodideSession.ts'

// Runs in a Web Worker, so a loop in the user's code cannot freeze the page and
// the runner can terminate it. Messages: init, then run or test with an id.
export type WorkerRequest =
  | { type: 'init'; indexURL: string }
  | { id: number; type: 'run'; code: string }
  | { id: number; type: 'test'; code: string; cases: string[] }

export type WorkerReply = { type: 'ready' } | { type: 'failed'; error: string } | { id: number; result: unknown } | { id: number; error: string }

let session: Promise<Session> | null = null

const post = (reply: WorkerReply) => self.postMessage(reply)

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'init') {
    session = loadPyodide({ indexURL: msg.indexURL }).then(createSession)
    session.then(
      () => post({ type: 'ready' }),
      (err: unknown) => post({ type: 'failed', error: err instanceof Error ? err.message : String(err) }),
    )
    return
  }
  try {
    if (!session) throw new Error('the worker was not initialised')
    const s = await session
    post({ id: msg.id, result: msg.type === 'run' ? s.run(msg.code) : s.test(msg.code, msg.cases) })
  } catch (err) {
    post({ id: msg.id, error: err instanceof Error ? err.message : String(err) })
  }
}
