import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface OpenOptions {
  busyTimeout?: number
}

// Loaded per call — open() runs once per process, and keeping this free of
// load-time effects lets bundlers drop the module when unused.
function getMigrations(): readonly string[] {
  return [
    fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8'),
    fs.readFileSync(path.join(import.meta.dirname, '001_target_fingerprints.sql'), 'utf8'),
    fs.readFileSync(path.join(import.meta.dirname, '002_transition_auto_toplevel.sql'), 'utf8'),
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
    db.exec('BEGIN')
    try {
      db.exec(migrations[version])
      version += 1
      db.exec(`PRAGMA user_version = ${version}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
