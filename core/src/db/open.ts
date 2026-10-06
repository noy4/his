import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import migration004 from './migrations/004_source_profiles_browser_identity.ts'
import type { Migration } from './migration.ts'

export interface OpenOptions {
  busyTimeout?: number
}

// Loaded per call — open() runs once per process, and keeping this free of
// load-time effects lets bundlers drop the module when unused.
function getMigrations(): readonly Migration[] {
  return [
    fs.readFileSync(path.join(import.meta.dirname, 'migrations/schema.sql'), 'utf8'),
    fs.readFileSync(path.join(import.meta.dirname, 'migrations/001_target_fingerprints.sql'), 'utf8'),
    fs.readFileSync(path.join(import.meta.dirname, 'migrations/002_transition_auto_toplevel.sql'), 'utf8'),
    fs.readFileSync(path.join(import.meta.dirname, 'migrations/003_transition_lowercase.sql'), 'utf8'),
    migration004,
  ]
}

export function open(dbPath: string, options: OpenOptions = {}): DatabaseSync {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`PRAGMA busy_timeout = ${options.busyTimeout ?? 5000}`)
  migrate(db)
  return db
}

function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get()
  let version = row === undefined ? 0 : Number(row.user_version)
  const migrations = getMigrations()
  while (version < migrations.length) {
    const migration = migrations[version]
    const toggleFk = typeof migration !== 'string' && migration.foreignKeys === false
    if (toggleFk) db.exec('PRAGMA foreign_keys = OFF')
    db.exec('BEGIN')
    try {
      if (typeof migration === 'string')
        db.exec(migration)
      else
        migration.up(db)
      version += 1
      db.exec(`PRAGMA user_version = ${version}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    } finally {
      if (toggleFk) db.exec('PRAGMA foreign_keys = ON')
    }
  }
}
