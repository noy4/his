import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Kysely } from 'kysely'
import { SqliteDialect } from 'kysely-sqlite'
import { FileMigrationProvider } from './migrator/file-migration-provider.ts'
import { Migrator, ensureMigrationTable, MIGRATION_TABLE } from './migrator/migrator.ts'
import type { DB } from './schema.ts'

// typed handle for query helpers
export type KyselyDb = Kysely<DB>

export interface OpenOptions {
  busyTimeout?: number
}

// migrations dir holds NNN_name.sql (raw) or NNN_name.ts
const MIGRATIONS_DIR = 'migrations'
// last user_version the legacy runner wrote (000..006)
const LEGACY_LATEST_VERSION = 7
// stamped after migrate; > legacy so the legacy runner no-ops
const SCHEMA_VERSION = LEGACY_LATEST_VERSION + 1
// squashed replacement for 000..006
const BASELINE_MIGRATION = '000_init'
// kysely's bookkeeping, superseded by MIGRATION_TABLE
const LEGACY_TABLES = ['kysely_migration', 'kysely_migration_lock']

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
  baselineLegacy(handle)
  const migrator = new Migrator({
    handle,
    db: createDb(handle),
    provider: new FileMigrationProvider({
      migrationFolder: path.join(import.meta.dirname, MIGRATIONS_DIR)
    }),
  })
  const { error } = await migrator.migrate()
  if (error !== undefined) throw error
  // stamp so a rollback to the legacy runner no-ops
  handle.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

// baseline existing archives so the squashed init does not re-run:
// v0 fresh runs normally; v7/v8 record 000_init + drop old tables; v1..v6 fail
function baselineLegacy(handle: DatabaseSync): void {
  if (tableExists(handle, MIGRATION_TABLE)) return
  const version = readUserVersion(handle)
  if (version === 0) return
  if (version < LEGACY_LATEST_VERSION)
    throw new Error(`archive is at legacy schema v${version}; run the previous release once to finish migrating, then retry`)
  ensureMigrationTable(handle)
  // OR IGNORE: a concurrent first open may have baselined
  handle.prepare(`INSERT OR IGNORE INTO ${MIGRATION_TABLE} (name, timestamp) VALUES (?, ?)`).run(BASELINE_MIGRATION, new Date().toISOString())
  for (const table of LEGACY_TABLES) handle.exec(`DROP TABLE IF EXISTS ${table}`)
  handle.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

function readUserVersion(handle: DatabaseSync): number {
  const row = handle.prepare('PRAGMA user_version').get()
  return row === undefined ? 0 : Number(row.user_version)
}

function tableExists(handle: DatabaseSync, name: string): boolean {
  return handle.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined
}
