import type { Card } from '../api.ts'
import { caseName, splitCases } from './cases.ts'
import type { PyRun } from './pyodideSession.ts'
import type { WorkerReply, WorkerRequest } from './python.worker.ts'
import type { CheckResult, RunResult, Runner, TestResult } from './runner.ts'

const TIMEOUT_MS = 10000
const TIMEOUT_MESSAGE = 'Stopped after 10 s'

type Reply = { result?: unknown; error?: string }
type Job = { type: 'run'; code: string } | { type: 'test'; code: string; cases: string[] }

// Python in a Web Worker. A run that does not finish in time is stopped by
// terminating the worker; a new worker starts for the next run. A worker that
// reports an error (the session is in an unknown state) is also replaced.
export class PythonRunner implements Runner {
  private worker: Worker | null = null
  private ready: Promise<void> = Promise.resolve()
  private rejectReady: ((err: Error) => void) | null = null
  private nextId = 1
  private readonly waiting = new Map<number, (reply: Reply | null) => void>()
  private disposed = false

  async prepare(): Promise<void> {
    if (!this.worker) this.respawn()
    await this.ready
  }

  private respawn(): void {
    this.worker?.terminate()
    this.rejectReady?.(new Error('Python was restarted'))
    for (const settle of this.waiting.values()) settle(null)
    this.waiting.clear()
    const worker = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker
    const indexURL = `${import.meta.env.BASE_URL}pyodide/`
    this.ready = new Promise<void>((resolve, reject) => {
      this.rejectReady = reject
      worker.onerror = (e) => reject(new Error(`Python failed to load: ${e.message || 'worker error'}`))
      worker.onmessage = (e: MessageEvent<WorkerReply>) => {
        const msg = e.data
        if ('type' in msg) {
          if (msg.type === 'ready') resolve()
          else reject(new Error(`Python failed to load: ${msg.error}`))
          return
        }
        const settle = this.waiting.get(msg.id)
        if (!settle) return
        this.waiting.delete(msg.id)
        settle(msg)
      }
      const init: WorkerRequest = { type: 'init', indexURL }
      worker.postMessage(init)
    })
    // A failed load is reported by the request that waits for it; this keeps
    // the rejection from being unhandled when no request is waiting.
    this.ready.catch(() => {})
  }

  // Resolves with null when the worker was stopped for taking too long.
  // A failed load is tried again once on the next request.
  private async request<T>(msg: Job): Promise<T | null> {
    if (this.disposed) throw new Error('Python is not loaded')
    try {
      await this.ready
    } catch {
      if (this.disposed) throw new Error('Python is not loaded')
      this.respawn()
      await this.ready
    }
    const worker = this.worker
    if (!worker || this.disposed) throw new Error('Python is not loaded')
    const id = this.nextId++
    let timer: ReturnType<typeof setTimeout> | undefined
    const reply = await new Promise<Reply | null>((resolve) => {
      this.waiting.set(id, resolve)
      timer = setTimeout(() => {
        this.waiting.delete(id)
        if (this.worker === worker && !this.disposed) this.respawn()
        resolve(null)
      }, TIMEOUT_MS)
      const request: WorkerRequest = { id, ...msg }
      worker.postMessage(request)
    })
    clearTimeout(timer)
    if (reply === null) return null
    if (reply.error !== undefined) {
      if (this.worker === worker && !this.disposed) this.respawn()
      throw new Error(reply.error)
    }
    return reply.result as T
  }

  async run(code: string): Promise<RunResult> {
    const start = performance.now()
    try {
      const raw = await this.request<PyRun>({ type: 'run', code })
      const ms = Math.round(performance.now() - start)
      if (raw === null) return { ok: false, error: { message: TIMEOUT_MESSAGE }, stdout: '', ms }
      const stdout = raw.stdout + raw.stderr
      if (raw.error) return { ok: false, error: raw.error, stdout, ms }
      return { ok: true, stdout, rows: null, note: null, ms }
    } catch (err) {
      return { ok: false, error: { message: err instanceof Error ? err.message : String(err) }, stdout: '', ms: Math.round(performance.now() - start) }
    }
  }

  async check(): Promise<CheckResult> {
    return { ok: false, message: 'Python cards use tests. Press Run tests.', expected: null, actual: null }
  }

  async test(code: string, card: Card): Promise<TestResult[]> {
    const cases = splitCases(card.tests)
    const failAll = (message: string) => cases.map((c) => ({ name: caseName(c), ok: false, error: { message } }))
    try {
      const raw = await this.request<TestResult[]>({ type: 'test', code, cases })
      return raw ?? failAll(TIMEOUT_MESSAGE)
    } catch (err) {
      return failAll(err instanceof Error ? err.message : String(err))
    }
  }

  dispose(): void {
    this.disposed = true
    this.rejectReady?.(new Error('Python is not loaded'))
    for (const settle of this.waiting.values()) settle(null)
    this.waiting.clear()
    this.worker?.terminate()
    this.worker = null
  }
}
