import type { Card } from '../api.ts'
import { splitCases } from './cases.ts'
import type { PyRun } from './pyodideSession.ts'
import type { WorkerReply, WorkerRequest } from './python.worker.ts'
import type { CheckResult, RunResult, Runner, TestResult } from './runner.ts'

const TIMEOUT_MS = 10000
const TIMEOUT_MESSAGE = 'Stopped after 10 s'

type Reply = { result?: unknown; error?: string }
type Job = { type: 'run'; code: string } | { type: 'test'; code: string; cases: string[] }

// Python in a Web Worker. A run that does not finish in time is stopped by
// terminating the worker; a new worker starts for the next run.
export class PythonRunner implements Runner {
  private worker: Worker | null = null
  private ready: Promise<void> = Promise.resolve()
  private nextId = 1
  private readonly waiting = new Map<number, (reply: Reply) => void>()
  private disposed = false

  async prepare(): Promise<void> {
    if (!this.worker) this.ready = this.spawn()
    await this.ready
  }

  private spawn(): Promise<void> {
    this.worker?.terminate()
    this.waiting.clear()
    const worker = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker
    const indexURL = `${import.meta.env.BASE_URL}pyodide/`
    return new Promise<void>((resolve, reject) => {
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
  }

  // Resolves with null when the worker was stopped for taking too long.
  private async request<T>(msg: Job): Promise<T | null> {
    await this.ready
    const worker = this.worker
    if (!worker || this.disposed) throw new Error('Python is not loaded')
    const id = this.nextId++
    let timer: ReturnType<typeof setTimeout> | undefined
    const reply = await new Promise<Reply | null>((resolve) => {
      this.waiting.set(id, resolve)
      timer = setTimeout(() => {
        this.waiting.delete(id)
        if (this.worker === worker && !this.disposed) this.ready = this.spawn()
        resolve(null)
      }, TIMEOUT_MS)
      const request: WorkerRequest = { id, ...msg }
      worker.postMessage(request)
    })
    clearTimeout(timer)
    if (reply === null) return null
    if (reply.error !== undefined) throw new Error(reply.error)
    return reply.result as T
  }

  async run(code: string): Promise<RunResult> {
    const start = performance.now()
    const raw = await this.request<PyRun>({ type: 'run', code })
    const ms = Math.round(performance.now() - start)
    if (raw === null) return { ok: false, error: { message: TIMEOUT_MESSAGE }, stdout: '', ms }
    if (raw.error) return { ok: false, error: raw.error, stdout: raw.stdout, ms }
    return { ok: true, stdout: raw.stdout + (raw.stderr ? `\n${raw.stderr}` : ''), rows: null, note: null, ms }
  }

  async check(): Promise<CheckResult> {
    return { ok: false, message: 'Python cards use tests. Press Run tests.', expected: null, actual: null }
  }

  async test(code: string, card: Card): Promise<TestResult[]> {
    const cases = splitCases(card.tests)
    const raw = await this.request<TestResult[]>({ type: 'test', code, cases })
    if (raw === null) return cases.map((c) => ({ name: c.split('\n')[0].slice(0, 60), ok: false, error: { message: TIMEOUT_MESSAGE } }))
    return raw
  }

  dispose(): void {
    this.disposed = true
    this.worker?.terminate()
    this.worker = null
    this.waiting.clear()
  }
}
