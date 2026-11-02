export type Language = 'python' | 'postgresql'

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'postgresql', label: 'PostgreSQL' },
]

// The editor language is remembered per set.
export function storedLanguage(setId: number): Language {
  return localStorage.getItem(`iterdeck.language.${setId}`) === 'postgresql' ? 'postgresql' : 'python'
}

export function storeLanguage(setId: number, language: Language): void {
  localStorage.setItem(`iterdeck.language.${setId}`, language)
}
