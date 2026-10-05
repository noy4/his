import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { defaultHome } from '../../state.ts'

// One-shot script — drops visits.source_transition from a v1-shaped archive.
// The column was only a raw-value escape hatch kept at import time and is
// never read by the API/UI. Safe to re-run: exits cleanly when the column is
// already gone. Run as: node core/src/db/scripts/drop_source_transition.ts [dbPath]

const DROP_SOURCE_TRANSITION_SQL = `
ALTER TABLE visits DROP COLUMN source_transition;
`

function hasSourceTransition(db: DatabaseSync): boolean {
  return (db.prepare('PRAGMA table_info(visits)').all() as unknown as { name: string }[])
    .some((column) => column.name === 'source_transition')
}

export function main(): void {
  const dbPath = process.argv[2] ?? path.join(defaultHome(), 'history.db')
  if (!fs.existsSync(dbPath)) {
    console.error(`no database at ${dbPath}`)
    process.exit(1)
  }
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA busy_timeout = 5000')
  try {
    if (!hasSourceTransition(db)) {
      console.log('visits.source_transition: already dropped')
      return
    }
    db.exec('BEGIN')
    try {
      db.exec(DROP_SOURCE_TRANSITION_SQL)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    console.log('visits.source_transition: dropped')
  } finally {
    db.close()
  }
}

main()
