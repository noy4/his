import type { DatabaseSync } from 'node:sqlite'

// one migration step: raw sql, or a code migration
export type Migration = string | CodeMigration

export interface CodeMigration {
  // foreign keys must toggle off outside a transaction while rows move
  foreignKeys?: false
  up(db: DatabaseSync): void
}
