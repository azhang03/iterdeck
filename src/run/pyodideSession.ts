import type { PyodideInterface } from 'pyodide'
import type { RunError, TestResult } from './runner.ts'

export type PyRun = { stdout: string; stderr: string; error: RunError | null }

export type Session = {
  run(code: string): PyRun
  test(code: string, cases: string[]): TestResult[]
}

// Python helpers that run the user's code with fresh globals and captured
// output. Error lines come from the frame in the user's code or the test case.
// Each test case runs against its own fresh execution of the solution, so no
// state carries over between cases.
const HELPER = `
import contextlib, io, textwrap, traceback

def _iterdeck_message(e):
    text = str(e)
    return f'{type(e).__name__}: {text}' if text else type(e).__name__

def _iterdeck_error(e, filename):
    if isinstance(e, SyntaxError) and e.filename == filename:
        return {'message': f'{type(e).__name__}: {e.msg}', 'line': e.lineno}
    line = None
    for frame in traceback.extract_tb(e.__traceback__):
        if frame.filename == filename:
            line = frame.lineno
    try:
        message = _iterdeck_message(e)
    except BaseException:
        message = type(e).__name__
    return {'message': message, 'line': line}

def _iterdeck_exec(code, filename, g, out, err):
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            exec(compile(code, filename, 'exec'), g)
        return None
    except SystemExit as e:
        return None if e.code in (None, 0) else _iterdeck_error(e, filename)
    except BaseException as e:
        return _iterdeck_error(e, filename)

def _iterdeck_run(code):
    g = {'__name__': '__main__'}
    out, err = io.StringIO(), io.StringIO()
    error = _iterdeck_exec(code, '<user>', g, out, err)
    return {'stdout': out.getvalue(), 'stderr': err.getvalue(), 'error': error}

def _iterdeck_case_name(case):
    for line in case.splitlines():
        if line.strip():
            return line.strip()[:60]
    return case[:60]

def _iterdeck_test(code, cases):
    results = []
    for case in cases:
        name = _iterdeck_case_name(case)
        g = {'__name__': '__main__'}
        quiet = io.StringIO()
        error = _iterdeck_exec(code, '<user>', g, quiet, quiet)
        if error is not None:
            results.append({'name': name, 'ok': False, 'error': {'message': 'The solution fails: ' + error['message'], 'line': None}})
            continue
        case_error = _iterdeck_exec(textwrap.dedent(case), '<case>', g, quiet, quiet)
        results.append({'name': name, 'ok': case_error is None, 'error': case_error})
    return results
`

type PyError = { message: string; line: number | null }
type PyRunRaw = { stdout: string; stderr: string; error: PyError | null }
type PyTestRaw = { name: string; ok: boolean; error: PyError | null }

function toError(e: PyError | null): RunError | null {
  if (!e) return null
  return e.line === null ? { message: e.message } : { message: e.message, line: e.line }
}

export async function createSession(pyodide: PyodideInterface): Promise<Session> {
  pyodide.runPython(HELPER)
  const runFn = pyodide.globals.get('_iterdeck_run')
  const testFn = pyodide.globals.get('_iterdeck_test')
  // Python dicts become plain objects; the proxy is released at once.
  const toJs = <T>(proxy: { toJs(opts: object): T; destroy(): void }): T => {
    try {
      return proxy.toJs({ dict_converter: Object.fromEntries })
    } finally {
      proxy.destroy()
    }
  }
  return {
    run(code) {
      const raw = toJs<PyRunRaw>(runFn(code))
      return { stdout: raw.stdout, stderr: raw.stderr, error: toError(raw.error) }
    },
    test(code, cases) {
      const raw = toJs<PyTestRaw[]>(testFn(code, cases))
      return raw.map((r) => ({ name: r.name, ok: r.ok, error: toError(r.error) }))
    },
  }
}
