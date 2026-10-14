import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { Kysely } from 'kysely'
import { SqliteDialect } from 'kysely-sqlite'
import { FileMigrationProvider, Migrator } from 'kysely/migration'
import type { DB } from './schema.ts'

// Archive DB handle for query helpers (the raw DatabaseSync is migration-only).
export type KyselyDb = Kysely<DB>

export interface OpenOptions {
  busyTimeout?: number
}

// migrations: db/migrations/NNN_name.ts, each exporting `up(db)`
const MIGRATIONS_DIR = 'migrations'
// last user_version the legacy runner wrote (migrations 000..006)
const LEGACY_LATEST_VERSION = 7
// version stamped after migrate; > LEGACY_LATEST_VERSION so the legacy runner no-ops
const SCHEMA_VERSION = LEGACY_LATEST_VERSION + 1
// squashed migration replacing 000..006 (see migrations/000_init.ts)
const BASELINE_MIGRATION = '000_init'

// ready-to-use archive: pragmas applied, migrations current
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

// Wrap an open, pragma-configured handle; the caller owns its lifecycle.
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

// Apply pending migrations; the caller keeps the handle's lifecycle.
export async function migrate(handle: DatabaseSync): Promise<void> {
  baselineLegacy(handle)
  const migrator = new Migrator({
    db: createDb(handle),
    provider: new FileMigrationProvider({
      fs: fsPromises,
      path,
      migrationFolder: path.join(import.meta.dirname, MIGRATIONS_DIR),
      // hand-written .ts migrations: load absolute paths as file URLs
      import: (filePath) => import(pathToFileURL(filePath).href),
    }),
  })
  const { error } = await migrator.migrateToLatest()
  if (error !== undefined) throw error
  // stamp the version so a rollback to the legacy runner no-ops
  handle.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

// Baseline existing archives so the squashed init does not re-run:
// - v7: record 000_init as applied, then stamp v8
// - v0 (fresh) / v8+: let the migrator run normally
// - v1..v6: fail loudly (the previous release finishes those)
function baselineLegacy(handle: DatabaseSync): void {
  const version = readUserVersion(handle)
  if (version === 0 || version > LEGACY_LATEST_VERSION) return
  if (version < LEGACY_LATEST_VERSION)
    throw new Error(`archive is at legacy schema v${version}; run the previous release once to finish migrating, then retry`)
  handle.exec('CREATE TABLE IF NOT EXISTS kysely_migration (name varchar(255) not null primary key, timestamp varchar(255) not null)')
  // INSERT OR IGNORE: a concurrent first open may have baselined
  handle.prepare('INSERT OR IGNORE INTO kysely_migration (name, timestamp) VALUES (?, ?)').run(BASELINE_MIGRATION, new Date().toISOString())
  handle.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

function readUserVersion(handle: DatabaseSync): number {
  const row = handle.prepare('PRAGMA user_version').get()
  return row === undefined ? 0 : Number(row.user_version)
}
