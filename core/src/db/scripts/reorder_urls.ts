import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import { historyDbPath, defaultHome } from '../../paths.ts'

// One-shot script — rebuilds urls in a v1-shaped archive (columns in the
// pre-HistoryItem order) into the current migrations/000_initial_schema.sql
// layout. Index naming is
// not handled here — see rename_indexes.ts. Not a migration: it is left out
// of open()'s migration list and user_version is left untouched, so both are
// safe to keep as pure out-of-band tooling.
// Run as: node core/src/db/scripts/reorder_urls.ts [dbPath]

const TARGET_URL_ORDER =
  'id,url,title,first_visit_time,last_visit_time,visit_count,typed_count'

// Keep in sync with 000_initial_schema.sql. Triggers must come off first: dropping urls
// runs an implicit DELETE of every row, and the fts triggers would feed each
// of those into urls_fts. The copy keeps rowids and values, so the
// external-content urls_fts stays consistent across the swap and is verified
// at the end instead of rebuilt.
const REBUILD_URLS_SQL = `
DROP TRIGGER IF EXISTS urls_fts_after_insert;
DROP TRIGGER IF EXISTS urls_fts_after_delete;
DROP TRIGGER IF EXISTS urls_fts_after_update;
DROP TABLE IF EXISTS urls_rebuild;
CREATE TABLE urls_rebuild (
  id               INTEGER PRIMARY KEY,
  url              TEXT    NOT NULL UNIQUE,
  title            TEXT,
  first_visit_time INTEGER NOT NULL,
  last_visit_time  INTEGER NOT NULL,
  visit_count      INTEGER NOT NULL DEFAULT 0,
  typed_count      INTEGER NOT NULL DEFAULT 0
);
INSERT INTO urls_rebuild (id, url, title, first_visit_time, last_visit_time, visit_count, typed_count)
SELECT id, url, title, first_visit_time, last_visit_time, visit_count, typed_count
FROM urls;
DROP TABLE urls;
ALTER TABLE urls_rebuild RENAME TO urls;
CREATE INDEX idx_urls_last_visit_time ON urls(last_visit_time DESC);
CREATE TRIGGER urls_fts_after_insert AFTER INSERT ON urls BEGIN
  INSERT INTO urls_fts(rowid, title, url)
  VALUES (new.id, new.title, new.url);
END;
CREATE TRIGGER urls_fts_after_delete AFTER DELETE ON urls BEGIN
  INSERT INTO urls_fts(urls_fts, rowid, title, url)
  VALUES ('delete', old.id, old.title, old.url);
END;
CREATE TRIGGER urls_fts_after_update AFTER UPDATE ON urls BEGIN
  INSERT INTO urls_fts(urls_fts, rowid, title, url)
  VALUES ('delete', old.id, old.title, old.url);
  INSERT INTO urls_fts(rowid, title, url)
  VALUES (new.id, new.title, new.url);
END;
INSERT INTO urls_fts(urls_fts) VALUES('integrity-check');
`

function urlsColumnOrder(db: DatabaseSync): string {
  return (db.prepare('PRAGMA table_info(urls)').all() as unknown as { name: string }[])
    .map((column) => column.name)
    .join(',')
}

export function alignUrlsSchema(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = OFF')
  try {
    db.exec('BEGIN')
    try {
      if (urlsColumnOrder(db) !== TARGET_URL_ORDER) db.exec(REBUILD_URLS_SQL)
      const violations = (db.prepare('PRAGMA foreign_key_check').all() as unknown[]).length
      if (violations > 0) {
        throw new Error(`foreign_key_check reported ${violations} violations`)
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }
}

// --- CLI entry ---

export function main(): void {
  const dbPath = process.argv[2] ?? historyDbPath(defaultHome())
  if (!fs.existsSync(dbPath)) {
    console.error(`no database at ${dbPath}`)
    process.exit(1)
  }
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA busy_timeout = 5000')
  try {
    const before = urlsColumnOrder(db)
    alignUrlsSchema(db)
    const after = urlsColumnOrder(db)
    console.log(`urls order: ${before} -> ${after}`)
    console.log('user_version:', Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0), '(unchanged)')
    console.log('foreign_key_check: ok')
  } finally {
    db.close()
  }
}

main()
