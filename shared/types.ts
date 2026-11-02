// Row shapes as the API returns them. Used by the server and the client.

export type Folder = {
  id: number
  name: string
  created_at: string
  last_used_at: string
}

export type CardSet = {
  id: number
  title: string
  folder_id: number | null
  code_mode: 0 | 1
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
  created_at: string
}

export type Image = {
  id: number
  file: string
  mime: string
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
}

export type FolderWithSets = Folder & { sets: CardSet[] }
export type SetWithCards = CardSet & { folder: Pick<Folder, 'id' | 'name'> | null; cards: Card[] }
