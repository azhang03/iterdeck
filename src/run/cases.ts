// A card's tests field holds one case per paragraph (cases are separated by a
// blank line). Each case is a Python snippet that runs after the solution.
// Indentation inside a case is kept; Python removes a common indent.
export function splitCases(tests: string): string[] {
  return tests
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((c) => c.replace(/^\n+|\s+$/g, ''))
    .filter((c) => c.trim() !== '')
}

// The first non-empty line of a case, cut at 60 characters. Must match
// _iterdeck_case_name in the Python helper.
export function caseName(c: string): string {
  const line = c.split('\n').find((l) => l.trim() !== '') ?? c
  return line.trim().slice(0, 60)
}
