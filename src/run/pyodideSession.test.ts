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

  it('runs each case against a copy of the solution globals', () => {
    const code = 'def two_sum(nums, target):\n    return [0, 1]'
    const results = session.test(code, ['assert two_sum([2, 7], 9) == [0, 1]', 'assert two_sum([3, 3], 6) == [0, 1]', 'assert two_sum([1, 2], 10) is None'])
    expect(results.map((r) => r.ok)).toEqual([true, true, false])
    expect(results[2]).toEqual({ name: 'assert two_sum([1, 2], 10) is None', ok: false, error: { message: 'AssertionError: ', line: 1 } })
  })

  it('a case cannot leak into the next case', () => {
    const results = session.test('x = 1', ['y = 2', 'assert y == 2'])
    expect(results.map((r) => r.ok)).toEqual([true, false])
  })

  it('fails every case with the solution error', () => {
    const results = session.test('1/0', ['assert True', 'assert True'])
    expect(results.map((r) => r.error?.message)).toEqual(['ZeroDivisionError: division by zero', 'ZeroDivisionError: division by zero'])
    expect(results.every((r) => !r.ok)).toBe(true)
  })

  it('names a case by its first non-empty line, cut at 60 characters', () => {
    const long = 'x'.repeat(80)
    const results = session.test('', [`\n\n  # ${long}\nassert True`])
    expect(results[0].name).toBe(`# ${long}`.slice(0, 60))
  })
})
