import type { Language } from '../../shared/types.ts'

export type { Language }

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'postgresql', label: 'PostgreSQL' },
]
