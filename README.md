# Iterdeck

Flashcards in the style of Quizlet, with a code mode that shows a card as a coding problem next to a code editor.

## What it does

- Folders and sets, with search and sort. A set can be in one folder.
- An editor for a set: cards with a term, a definition, and an image on each side; drag to reorder; swap all sides; Tab on the last card adds one.
- A set page with the cards, a star on each, inline edit, and an order by the Flashcards stats.
- Card text is markdown (GFM). A single line break stays a line break; indented code needs a fenced block. Fenced code blocks tagged `python` or `sql` are highlighted with the editor's parsers and colours; other languages show as plain monospace. Raw HTML shows as text.
- Flashcards: flip, sort with X and check (keys 1 and 2), undo, shuffle, rounds over the missed cards until none are missed. Each sort updates the card's stats.
- Learn: the cards in groups of n. Passes over the missed cards follow at once; a debrief shows when a group is done or a card is carried (the one-card rule: a solo second chance, then carry to the next group).
- Code mode: with it on, Flashcards and Learn show the card as a problem description next to a CodeMirror editor. The side used last gets the keys.
- Running code: a set picks a language. PostgreSQL sets upload CSV files that become tables; Run (Cmd+Enter) shows the rows and Check compares them with the query on the back of the card. Python sets run in the browser; each card can carry test cases, and Run tests (Cmd+Shift+Enter) shows each case as pass or fail. Both run in the browser (PGlite and Pyodide), with no install. The code written for each card is saved. Pull from previous card copies the code of the card before this one in the set into the editor, so a follow-up can build on the answer to the part before it; the order is the set's, not the order of the session.
- Sessions: leave a Flashcards or Learn page and come back to the same session. Flashcards continues at the first card not yet sorted; Learn at the first card of the current group. Restart starts over and clears the code written for every card.
- Clocks: Flashcards and Learn show two clocks at the top. Card is the time on the current card. It starts again with each card. Session is the total time of the session. The time is saved with the session. Time away from the page does not count. The clock stops when the session is complete.
- Scorecard: the end of a Flashcards round and of a Learn group shows each card with its result and the time on it. Code mode adds the last test run of each card. Flashcards keeps the times of a round when the user leaves the page. Both modes keep the test results with the saved session.
- Motion: a sort gives a green or amber glow. A plain card is then thrown right (checked) or left (missed) and the next card rises in; in code mode the panel glows and the next card fades in. A flip turns the card. The cases of a test run show one by one. A key press never waits for an animation. With the system setting for reduced motion, only the glow stays.
- Light and dark: a button in the sidebar and in the study header switches the colour scheme. The choice is saved in the browser. With no saved choice the app follows the system setting.

## Run

Needs Node 20.19 or newer, or 22.12 or newer.

```
npm install
npm run dev
```

The client runs on http://localhost:5173 and the API on http://localhost:3001. The client proxies `/api`, `/images`, and `/files` to the API.

Other scripts: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.

## Data

All data lives in `data/` at the repo root (git-ignored): `data/iterdeck.db` (SQLite, with the cards, the study progress, and the code per card), `data/images/`, and `data/files/` (the CSV files of PostgreSQL sets). Back up by copying the folder. Set `ITERDECK_DATA` to use another folder. Images that no card references, and files that no set names, are deleted after one day.

## Code map

- `src/` is the client (React, Vite, TypeScript, Tailwind, React Router).
  - `pages/` has one file per route: Home, Folders, Sets, Folder, Set, Editor, Flashcards, Learn.
  - `components/` has the shared UI: layout, dialogs, the editor panels (`CardPanel`, `CodeSettings`), the study pieces (`StudyShell`, `StudyCard`, `SortControls`, `ProgressBar`, `OptionsPanel`, `Clock`, `Scorecard`), `ThemeToggle`, code mode (`CodeStudyLayout`, `ProblemPanel`, `CodeEditor`, `OutputPanel`), and `CardText` (markdown rendering, styled in `index.css`).
  - `study/` has the logic without React: `flashcards.ts` (rounds), `learn.ts` (groups and the one-card rule), `clock.ts` (the stopwatch and the clock text), `scorecard.ts` (card names and sums for the scorecard), `order.ts` (the card before a card in the set), `stats.ts`, `options.ts`, `languages.ts`. Unit tested, except `motion.ts`, which has the animations of the study pages (DOM and Web Animations, no React).
  - `run/` runs code in the browser: `runner.ts` (the interface), `sql.ts` (PGlite), `python.ts` with `python.worker.ts` and `pyodideSession.ts` (Pyodide), `compare.ts` (row comparison for Check), `cases.ts` (test case splitting). Unit tested in Node.
  - `editor/cards.ts` has the editor's card helpers. `editor/highlight.ts` has the one highlighter for the code editor and for code blocks in card text.
  - `index.css` has the colours of the light and the dark scheme as tokens (`bg-surface`, `text-muted`, `border-line`, and so on). Components use the tokens, not fixed colours. `theme.ts` reads and switches the scheme; `index.html` sets it before the first paint.
  - `hooks.ts` has `useAsync`, `useDebounced`, and the study page hooks (`useStudyPage`, `useProgressSaver`, `useSessionClock`, `useCardTime`, `useStudyMotion`, `useCodeDocs`, `useCodeSaver`).
  - `api.ts` has typed fetch helpers for the API.
- `shared/types.ts` has the row types that the client and the server share.
- `server/` is the API (Express, better-sqlite3).
  - `index.ts` opens the database and starts the app.
  - `app.ts` builds the Express app: routes, static `/images` and `/files`, the error handler.
  - `db.ts` opens the SQLite file, runs `schema.sql`, and adds columns that an older database lacks.
  - `validate.ts` has the request checks and the error classes.
  - `routes/` has one file per resource: folders, sets, cards, images, files.
  - `csv.ts` reads a CSV header and sample and infers the column types.
  - `images.ts` deletes images that no card references and files that no set names.
  - `paths.ts` resolves the data folder.
  - `app.test.ts` runs the routes against a temp database.
