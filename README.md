# Iterdeck

Flashcards in the style of Quizlet, with a code mode that shows a card as a coding problem next to a code editor.

## Run

Needs Node 20 or newer.

```
npm install
npm run dev
```

The client runs on http://localhost:5173 and the API on http://localhost:3001. The client proxies `/api` and `/images` to the API.

Other scripts: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.

## Data

All data lives in `data/` at the repo root (git-ignored): `data/iterdeck.db` (SQLite) and `data/images/`. Back up by copying the folder. Set `ITERDECK_DATA` to use another folder.

## Code map

- `src/` is the client (React, Vite, TypeScript, Tailwind, React Router).
  - `pages/` has one file per route.
  - `components/` has shared UI.
  - `study/` has the round logic for Flashcards and Learn, without React.
  - `api.ts` has typed fetch helpers for the API.
- `server/` is the API (Express, better-sqlite3).
  - `index.ts` starts the app and serves `/images`.
  - `paths.ts` resolves the data folder.
