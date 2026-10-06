import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import type { CodeMigration, Migration } from './migration.ts'

export type { CodeMigration, Migration } from './migration.ts'

export interface OpenOptions {
  busyTimeout?: number
}

// migrations live in db/migrations as NNN_name.sql (raw) or NNN_name.ts
// (default-exported CodeMigration). Loaded per open() — keeps load-time
// effects out of this module and lets bundlers drop it when unused.
const MIGRATIONS_DIR = 'migrations'

export async function open(dbPath: string, options: OpenOptions = {}): Promise<DatabaseSync> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`PRAGMA busy_timeout = ${options.busyTimeout ?? 5000}`)
  await migrate(db)
  return db
}

async function migrate(db: DatabaseSync): Promise<void> {
  const row = db.prepare('PRAGMA user_version').get()
  let version = row === undefined ? 0 : Number(row.user_version)
  const migrations = await loadMigrations()
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

async function loadMigrations(): Promise<readonly Migration[]> {
  const dir = path.join(import.meta.dirname, MIGRATIONS_DIR)
  const names = fs.readdirSync(dir).filter((name) => name.endsWith('.sql') || name.endsWith('.ts'))
  // version order IS the sorted filename — a misnamed file would silently shift
  // slots, so fail loudly instead of skipping
  for (const name of names) {
    if (!/^\d+_/.test(name))
      throw new Error(`migration file must be named NNN_name: ${name}`)
  }
  names.sort()
  const migrations: Migration[] = []
  for (const name of names) {
    const file = pathToFileURL(path.join(dir, name))
    if (name.endsWith('.ts')) {
      const module = await import(file.href)
      if (module === null || typeof module !== 'object' || typeof module.default !== 'object' || module.default === null || typeof module.default.up !== 'function')
        throw new Error(`migration ${name} must default-export an object with up(db)`)
      migrations.push(module.default as CodeMigration)
    } else {
      migrations.push(fs.readFileSync(path.join(dir, name), 'utf8'))
    }
  }
  return migrations
}
