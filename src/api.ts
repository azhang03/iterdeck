import type {
  Card,
  CardInput,
  CardSet,
  FolderWithSets,
  Folder,
  Image,
  Language,
  ListSort,
  SetFile,
  SetWithCards,
} from '../shared/types.ts'

export type { Card, CardInput, CardSet, Folder, FolderWithSets, Image, Language, ListSort, SetFile, SetWithCards }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(path, init)
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data.error ?? res.statusText)
  }
  return (await res.json()) as T
}

function listQuery(opts: { sort?: ListSort; q?: string; folder?: number | 'none' }): string {
  const p = new URLSearchParams()
  if (opts.sort) p.set('sort', opts.sort)
  if (opts.q) p.set('q', opts.q)
  if (opts.folder !== undefined) p.set('folder', String(opts.folder))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  folders: {
    list: (opts: { sort?: ListSort; q?: string } = {}) => request<Folder[]>('GET', `/api/folders${listQuery(opts)}`),
    create: (name: string) => request<Folder>('POST', '/api/folders', { name }),
    get: (id: number, opts: { sort?: ListSort; q?: string } = {}) =>
      request<FolderWithSets>('GET', `/api/folders/${id}${listQuery(opts)}`),
    rename: (id: number, name: string) => request<Folder>('PATCH', `/api/folders/${id}`, { name }),
    remove: (id: number) => request<void>('DELETE', `/api/folders/${id}`),
  },
  sets: {
    list: (opts: { sort?: ListSort; q?: string; folder?: number | 'none' } = {}) =>
      request<CardSet[]>('GET', `/api/sets${listQuery(opts)}`),
    create: (title: string, folder_id: number | null = null) => request<CardSet>('POST', '/api/sets', { title, folder_id }),
    get: (id: number) => request<SetWithCards>('GET', `/api/sets/${id}`),
    open: (id: number) => request<CardSet>('POST', `/api/sets/${id}/open`),
    update: (id: number, patch: { title?: string; folder_id?: number | null; code_mode?: boolean; language?: Language | null }) =>
      request<CardSet>('PATCH', `/api/sets/${id}`, patch),
    replaceCards: (id: number, cards: CardInput[]) => request<SetWithCards>('PUT', `/api/sets/${id}/cards`, cards),
    remove: (id: number) => request<void>('DELETE', `/api/sets/${id}`),
  },
  cards: {
    update: (id: number, patch: { term?: string; definition?: string; starred?: boolean; tests?: string; ordered?: boolean; code?: string }) =>
      request<Card>('PATCH', `/api/cards/${id}`, patch),
    sort: (id: number, checked: boolean, undo = false) => request<Card>('POST', `/api/cards/${id}/sort`, { checked, undo }),
  },
  images: {
    upload: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return request<Image & { url: string }>('POST', '/api/images', form)
    },
    url: (image: Pick<Image, 'file'>) => `/images/${image.file}`,
  },
  files: {
    list: (setId: number) => request<SetFile[]>('GET', `/api/sets/${setId}/files`),
    upload: (setId: number, file: File) => {
      const form = new FormData()
      form.append('file', file)
      return request<SetFile>('POST', `/api/sets/${setId}/files`, form)
    },
    remove: (setId: number, fileId: number) => request<void>('DELETE', `/api/sets/${setId}/files/${fileId}`),
  },
}
