import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import { historyDbPath, defaultHome } from '../../paths.ts'

// One-shot script — normalizes index names to the idx_<table>_<columns>
// convention of migrations/000_initial_schema.sql. Drops the v1 names and the
// dev-era intermediates, then creates the current names only where missing.
// Keep in sync with 000_initial_schema.sql when index definitions change. Safe to re-run.

const RENAME_SQL = `
DROP INDEX IF EXISTS visits_time;
DROP INDEX IF EXISTS visits_url;
DROP INDEX IF EXISTS urls_last;
DROP INDEX IF EXISTS idx_visits_time;
DROP INDEX IF EXISTS idx_visits_url;
DROP INDEX IF EXISTS idx_urls_last;
CREATE INDEX IF NOT EXISTS idx_visits_visit_time ON visits(visit_time DESC);
CREATE INDEX IF NOT EXISTS idx_visits_url_id_visit_time ON visits(url_id, visit_time DESC);
CREATE INDEX IF NOT EXISTS idx_urls_last_visit_time ON urls(last_visit_time DESC);
`

function indexNames(db: DatabaseSync): string {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_auto%' ORDER BY name").all() as unknown as { name: string }[])
    .map((row) => row.name)
    .join(', ')
}

export function main(): void {
  const dbPath = process.argv[2] ?? historyDbPath(defaultHome())
  if (!fs.existsSync(dbPath)) {
    console.error(`no database at ${dbPath}`)
    process.exit(1)
  }
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA busy_timeout = 5000')
  try {
    const before = indexNames(db)
    db.exec('BEGIN')
    try {
      db.exec(RENAME_SQL)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    console.log(`indexes: ${before}`)
    console.log(`      -> ${indexNames(db)}`)
  } finally {
    db.close()
  }
}

main()
