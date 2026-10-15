import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Kysely } from 'kysely'
import { SqliteDialect } from 'kysely-sqlite'
import { FileMigrationProvider } from './migrator/file-migration-provider.ts'
import { Migrator } from './migrator/migrator.ts'
import type { DB } from './schema.ts'

// typed handle for query helpers
export type KyselyDb = Kysely<DB>

export interface OpenOptions {
  busyTimeout?: number
}

// migrations dir holds NNN_name.sql (raw) or NNN_name.ts
const MIGRATIONS_DIR = 'migrations'

// ready-to-use archive
export async function initDb(dbPath: string, options: OpenOptions = {}): Promise<KyselyDb> {
  const handle = open(dbPath, options)
  try {
    await migrate(handle)
  } catch (error) {
    handle.close()
    throw error
  }
  return createDb(handle)
}

// Wrap an open, pragma-configured handle
export function createDb(handle: DatabaseSync): KyselyDb {
  return new Kysely<DB>({
    dialect: new SqliteDialect({ database: handle })
  })
}

export function open(dbPath: string, options: OpenOptions = {}): DatabaseSync {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`PRAGMA busy_timeout = ${options.busyTimeout ?? 5000}`)
  return db
}

// Apply pending migrations
export async function migrate(handle: DatabaseSync): Promise<void> {
  const migrator = new Migrator({
    handle,
    db: createDb(handle),
    provider: new FileMigrationProvider({
      migrationFolder: path.join(import.meta.dirname, MIGRATIONS_DIR),
    }),
  })
  await migrator.migrate()
}
