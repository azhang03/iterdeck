CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY,
  file TEXT NOT NULL,
  mime TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  code_mode INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  term TEXT NOT NULL DEFAULT '',
  definition TEXT NOT NULL DEFAULT '',
  term_image_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
  definition_image_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
  starred INTEGER NOT NULL DEFAULT 0,
  checked_count INTEGER NOT NULL DEFAULT 0,
  sorted_count INTEGER NOT NULL DEFAULT 0,
  tests TEXT NOT NULL DEFAULT '',
  ordered INTEGER NOT NULL DEFAULT 0,
  code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS set_files (
  id INTEGER PRIMARY KEY,
  set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  file TEXT NOT NULL,
  columns TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (set_id, table_name)
);

CREATE INDEX IF NOT EXISTS cards_set_position ON cards(set_id, position);
CREATE INDEX IF NOT EXISTS sets_folder ON sets(folder_id);
