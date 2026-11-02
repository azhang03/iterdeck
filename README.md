# Iterdeck

Flashcards in the style of Quizlet, with a code mode that shows a card as a coding problem next to a code editor.

## Run

Needs Node 20.19 or newer, or 22.12 or newer.

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
  - `api.ts` has typed fetch helpers for the API.
- `shared/types.ts` has the row types that the client and the server share.
- `server/` is the API (Express, better-sqlite3).
  - `index.ts` opens the database and starts the app.
  - `app.ts` builds the Express app: routes, static `/images`, the error handler.
  - `db.ts` opens the SQLite file and runs `schema.sql`.
  - `validate.ts` has the request checks and the error classes.
  - `routes/` has one file per resource: folders, sets, cards, images.
  - `paths.ts` resolves the data folder.
  - `app.test.ts` runs the routes against a temp database.
