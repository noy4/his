import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import { historyDbPath, defaultHome } from '../../paths.ts'

// One-shot maintenance script template
// Run as: node core/src/db/scripts/<name>.ts [dbPath]

const SQL = `
-- statements
`

function alreadyApplied(_db: DatabaseSync): boolean {
  return false
}

export function main(): void {
  const dbPath = process.argv[2] ?? historyDbPath(defaultHome())
  if (!fs.existsSync(dbPath)) {
    console.error(`no database at ${dbPath}`)
    process.exit(1)
  }
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA busy_timeout = 5000')
  try {
    if (alreadyApplied(db)) {
      console.log('already applied')
      return
    }
    db.exec('BEGIN')
    try {
      db.exec(SQL)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    console.log('applied')
  } finally {
    db.close()
  }
}

main()
