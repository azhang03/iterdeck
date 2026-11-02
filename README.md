# Iterdeck

Flashcards in the style of Quizlet, with a code mode that shows a card as a coding problem next to a code editor.

## What it does

- Folders and sets, with search and sort. A set can be in one folder.
- An editor for a set: cards with a term, a definition, and an image on each side; drag to reorder; swap all sides; Tab on the last card adds one.
- A set page with the cards, a star on each, inline edit, and an order by the Flashcards stats.
- Flashcards: flip, sort with X and check (keys 1 and 2), undo, shuffle, rounds over the missed cards until none are missed. Each sort updates the card's stats.
- Learn: the cards in groups of n, with a debrief after each round and the one-card rule (a solo second chance, then carry to the next group).
- Code mode: with it on, Flashcards and Learn show the card as a problem description next to a CodeMirror editor (Python, PostgreSQL). The side used last gets the keys.

## Run

Needs Node 20.19 or newer, or 22.12 or newer.

```
npm install
npm run dev
```

The client runs on http://localhost:5173 and the API on http://localhost:3001. The client proxies `/api` and `/images` to the API.

Other scripts: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.

## Data

All data lives in `data/` at the repo root (git-ignored): `data/iterdeck.db` (SQLite) and `data/images/`. Back up by copying the folder. Set `ITERDECK_DATA` to use another folder. Images that no card references are deleted after one day.

## Code map

- `src/` is the client (React, Vite, TypeScript, Tailwind, React Router).
  - `pages/` has one file per route: Home, Folders, Sets, Folder, Set, Editor, Flashcards, Learn.
  - `components/` has the shared UI: layout, dialogs, the editor panels, the study pieces (`StudyShell`, `StudyCard`, `SortControls`, `ProgressBar`, `OptionsPanel`), and code mode (`CodeStudyLayout`, `ProblemPanel`, `CodeEditor`).
  - `study/` has the logic without React: `flashcards.ts` (rounds), `learn.ts` (groups and the one-card rule), `stats.ts`, `options.ts`, `languages.ts`. Unit tested.
  - `editor/cards.ts` has the editor's card helpers.
  - `hooks.ts` has `useAsync` and `useDebounced`.
  - `api.ts` has typed fetch helpers for the API.
- `shared/types.ts` has the row types that the client and the server share.
- `server/` is the API (Express, better-sqlite3).
  - `index.ts` opens the database and starts the app.
  - `app.ts` builds the Express app: routes, static `/images`, the error handler.
  - `db.ts` opens the SQLite file and runs `schema.sql`.
  - `validate.ts` has the request checks and the error classes.
  - `routes/` has one file per resource: folders, sets, cards, images.
  - `images.ts` deletes images that no card references.
  - `paths.ts` resolves the data folder.
  - `app.test.ts` runs the routes against a temp database.
