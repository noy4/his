import { DatabaseSync } from 'node:sqlite'
import { generate, getDialect } from 'kysely-codegen'
import { createDb, migrate } from '../src/db/db.ts'

const check = process.argv.includes('--check')

const handle = new DatabaseSync(':memory:')
await migrate(handle)
await generate({
  db: createDb(handle),
  dialect: getDialect('sqlite'),
  outFile: './src/db/schema.ts',
  // FTS shadow tables + the migrator's bookkeeping are not app tables
  excludePattern: '{urls_fts*,kysely_migration*}',
  verify: check,
})
handle.close()
