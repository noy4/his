import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

export interface OpenOptions {
  busyTimeout?: number
}

// one migration step: raw sql, or a code migration
export type Migration = string | CodeMigration

export interface CodeMigration {
  // foreign keys must toggle off outside a transaction while rows move
  foreignKeys?: false
  up(db: DatabaseSync): void
}

// migrations live in db/migrations as NNN_name.sql (raw) or NNN_name.ts
// (default-exported CodeMigration). Loaded per initDb() — keeps load-time
// effects out of this module and lets bundlers drop it when unused.
const MIGRATIONS_DIR = 'migrations'

// archive db, ready to use: pragmas applied, migrations current
export async function initDb(dbPath: string, options: OpenOptions = {}): Promise<DatabaseSync> {
  const db = open(dbPath, options)
  await migrate(db)
  return db
}

export function open(dbPath: string, options: OpenOptions = {}): DatabaseSync {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`PRAGMA busy_timeout = ${options.busyTimeout ?? 5000}`)
  return db
}

export async function migrate(db: DatabaseSync): Promise<void> {
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
