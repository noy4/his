import type { DatabaseSync } from 'node:sqlite'
import type { KyselyDb } from '../db.ts'

// applied migration names + ISO timestamps
export const MIGRATION_TABLE = 'migrations'

// what a migration can touch
export interface MigrationContext {
  handle: DatabaseSync
  db: KyselyDb
}

export interface Migration {
  up(ctx: MigrationContext): void | Promise<void>
}

export interface MigrationEntry {
  name: string
  migration: Migration
}

export interface MigrationProvider {
  getMigrations(): Promise<MigrationEntry[]>
}

export interface MigrationResult {
  migrationName: string
  status: 'Success' | 'Error'
}

export interface MigrationResultSet {
  error?: Error
  results: MigrationResult[]
}

export interface MigratorProps {
  handle: DatabaseSync
  db: KyselyDb
  provider: MigrationProvider
}

// runs unapplied migrations in name order
export class Migrator {
  readonly #handle: DatabaseSync
  readonly #db: KyselyDb
  readonly #provider: MigrationProvider

  constructor(props: MigratorProps) {
    this.#handle = props.handle
    this.#db = props.db
    this.#provider = props.provider
  }

  async migrate(): Promise<MigrationResultSet> {
    const results: MigrationResult[] = []
    try {
      const migrations = await this.#resolveMigrations()
      ensureMigrationTable(this.#handle)
      const executed = this.#getExecutedMigrations()
      this.#ensureMigrationsInOrder(migrations, executed)
      const pending = migrations.filter((migration) => !executed.includes(migration.name))
      if (pending.length === 0) return { results }

      const ctx: MigrationContext = { handle: this.#handle, db: this.#db }
      // one transaction for the whole run
      this.#handle.exec('BEGIN')
      try {
        for (const { name, migration } of pending) {
          try {
            await migration.up(ctx)
          } catch (error) {
            results.push({ migrationName: name, status: 'Error' })
            throw error
          }
          this.#recordMigration(name)
          results.push({ migrationName: name, status: 'Success' })
        }
        this.#handle.exec('COMMIT')
      } catch (error) {
        this.#handle.exec('ROLLBACK')
        return { error: asError(error), results }
      }
      return { results }
    } catch (error) {
      return { error: asError(error), results }
    }
  }

  async #resolveMigrations(): Promise<MigrationEntry[]> {
    const migrations = await this.#provider.getMigrations()
    return [...migrations].sort((a, b) => a.name.localeCompare(b.name))
  }

  #getExecutedMigrations(): string[] {
    return this.#handle
      .prepare(`SELECT name, timestamp FROM ${MIGRATION_TABLE}`)
      .all()
      .map((row) => ({
        name: String(row.name),
        timestamp: String(row.timestamp),
      }))
      // ties broken by name
      .sort((a, b) => a.timestamp === b.timestamp
        ? a.name.localeCompare(b.name)
        : a.timestamp.localeCompare(b.timestamp))
      .map((row) => row.name)
  }

  #recordMigration(name: string): void {
    this.#handle.prepare(`INSERT INTO ${MIGRATION_TABLE} (name, timestamp) VALUES (?, ?)`).run(name, new Date().toISOString())
  }

  #ensureMigrationsInOrder(migrations: { name: string }[], executed: string[]): void {
    for (let i = 0; i < executed.length; i++) {
      if (migrations[i]?.name !== executed[i])
        throw new Error(`corrupted migrations: expected previously executed migration ${executed[i]} at index ${i} but found ${migrations[i]?.name ?? 'nothing'}; new migrations must sort after the last executed one`)
    }
  }
}

// --- helpers ---

export function ensureMigrationTable(handle: DatabaseSync): void {
  handle.exec(`CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (name varchar(255) not null primary key, timestamp varchar(255) not null)`)
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}
