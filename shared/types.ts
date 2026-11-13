// Row shapes as the API returns them. Used by the server and the client.

export type Folder = {
  id: number
  name: string
  created_at: string
  last_used_at: string
}

export type Language = 'python' | 'postgresql'

export type CardSet = {
  id: number
  title: string
  folder_id: number | null
  code_mode: 0 | 1
  language: Language | null
  created_at: string
  updated_at: string
  last_used_at: string
}

export type Card = {
  id: number
  set_id: number
  position: number
  term: string
  definition: string
  term_image_id: number | null
  definition_image_id: number | null
  // Set by the server from the images table; null when there is no image.
  term_image_url: string | null
  definition_image_url: string | null
  starred: 0 | 1
  checked_count: number
  sorted_count: number
  // Code mode: test cases for Python, row order for PostgreSQL, the saved code.
  tests: string
  ordered: 0 | 1
  code: string
  // The user's note to self about this card, shown in the study modes.
  note: string
  created_at: string
}

export type Image = {
  id: number
  file: string
  mime: string
  created_at: string
}

export type ColumnType = 'bigint' | 'numeric' | 'boolean' | 'date' | 'timestamptz' | 'text'

// A CSV file loaded as a table when a PostgreSQL set runs.
export type SetFile = {
  id: number
  set_id: number
  table_name: string
  file: string
  columns: { name: string; type: ColumnType }[]
  row_count: number
  size: number
  created_at: string
}

export type ListSort = 'created' | 'used' | 'name'

// Body of PUT /api/sets/:id/cards. A card with an id keeps its stars and stats.
export type CardInput = {
  id?: number
  term: string
  definition: string
  term_image_id: number | null
  definition_image_id: number | null
  tests: string
  ordered: boolean
}

export type FolderWithSets = Folder & { sets: CardSet[] }

// A study session's saved position. The client defines the shape and checks it
// when it resumes; the server stores it as JSON.
export type StudyMode = 'flashcards' | 'learn'
export type StudyProgress = Record<StudyMode, unknown>

export type SetWithCards = CardSet & {
  folder: Pick<Folder, 'id' | 'name'> | null
  cards: Card[]
  files: SetFile[]
  progress: StudyProgress
}
