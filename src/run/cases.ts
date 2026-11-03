// A card's tests field holds one case per paragraph (cases are separated by a
// blank line). Each case is a Python snippet that runs after the solution.
export function splitCases(tests: string): string[] {
  return tests
    .split(/\n[ \t]*\n/)
    .map((c) => c.trim())
    .filter((c) => c !== '')
}
