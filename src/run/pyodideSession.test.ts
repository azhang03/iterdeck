import { loadPyodide } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSession, type Session } from './pyodideSession.ts'

describe('pyodide session', () => {
  let session: Session

  beforeAll(async () => {
    session = await createSession(await loadPyodide())
  }, 120000)

  it('captures stdout', () => {
    expect(session.run('print("hi")')).toEqual({ stdout: 'hi\n', stderr: '', error: null })
  })

  it('reports a runtime error with the line in the user code', () => {
    const r = session.run('x = 1\ny = 2\nz = w')
    expect(r.error).toEqual({ message: "NameError: name 'w' is not defined", line: 3 })
  })

  it('reports a syntax error with its line', () => {
    const r = session.run('def f(:')
    expect(r.error?.message).toMatch(/^SyntaxError: /)
    expect(r.error?.line).toBe(1)
  })

  it('finds the user frame under a call from a library function', () => {
    const r = session.run('import json\n\njson.loads("{")')
    expect(r.error?.message).toMatch(/^JSONDecodeError: /)
    expect(r.error?.line).toBe(3)
  })

  it('does not share globals between runs', () => {
    session.run('a = 5')
    expect(session.run('print(a)').error?.message).toBe("NameError: name 'a' is not defined")
  })

  it('keeps stdout from before an error', () => {
    const r = session.run('print("before")\n1/0')
    expect(r.stdout).toBe('before\n')
    expect(r.error).toEqual({ message: 'ZeroDivisionError: division by zero', line: 2 })
  })

  it('runs each case against a fresh run of the solution', () => {
    const code = 'def two_sum(nums, target):\n    return [0, 1]'
    const results = session.test(code, ['assert two_sum([2, 7], 9) == [0, 1]', 'assert two_sum([3, 3], 6) == [0, 1]', 'assert two_sum([1, 2], 10) is None'])
    expect(results.map((r) => r.ok)).toEqual([true, true, false])
    expect(results[2]).toEqual({ name: 'assert two_sum([1, 2], 10) is None', ok: false, error: { message: 'AssertionError', line: 1 } })
  })

  it('no state leaks between cases, not even through solution globals', () => {
    expect(session.test('x = 1', ['y = 2', 'assert y == 2']).map((r) => r.ok)).toEqual([true, false])
    const counter = 'n = 0\ndef f():\n    global n\n    n += 1\n    return n'
    expect(session.test(counter, ['assert f() == 1', 'assert f() == 1']).map((r) => r.ok)).toEqual([true, true])
  })

  it('fails every case with the solution error and no case line', () => {
    const results = session.test('x = 1\n1/0', ['assert True', 'assert True'])
    expect(results.map((r) => r.error)).toEqual([
      { message: 'The solution fails: ZeroDivisionError: division by zero' },
      { message: 'The solution fails: ZeroDivisionError: division by zero' },
    ])
    expect(results.every((r) => !r.ok)).toBe(true)
  })

  it('removes a common indent from a case and reports a syntax error in it', () => {
    const results = session.test('f = lambda: 1', ['    x = f()\n    assert x == 1', 'assert f( == 1'])
    expect(results[0].ok).toBe(true)
    expect(results[1].error?.message).toMatch(/^SyntaxError/)
    expect(results[1].error?.line).toBe(1)
  })

  it('treats a clean sys.exit as success and a non-zero one as an error', () => {
    expect(session.run('print("a")\nimport sys\nsys.exit()')).toEqual({ stdout: 'a\n', stderr: '', error: null })
    expect(session.run('import sys\nsys.exit(3)').error).toEqual({ message: 'SystemExit: 3', line: 2 })
  })

  it('survives an exception whose message cannot be built', () => {
    const r = session.run('class E(Exception):\n    def __str__(self): raise ValueError()\nraise E()')
    expect(r.error).toEqual({ message: 'E', line: 3 })
  })

  it('names a case by its first non-empty line, cut at 60 characters', () => {
    const long = 'x'.repeat(80)
    const results = session.test('', [`\n\n  # ${long}\nassert True`])
    expect(results[0].name).toBe(`# ${long}`.slice(0, 60))
  })
})
