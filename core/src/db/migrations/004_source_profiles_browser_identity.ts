import type { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import type { CodeMigration } from '../db.ts'
import { CHROMIUM_BROWSERS } from '../../sync/sources/chromium.ts'
import { slugifyDir } from '../../sync/sources/dirs.ts'
import { takeoutProfileKey } from '../../sync/sources/takeout.ts'

// table rebuild: profile identity moves from (kind, profile_path) to (browser, profile).
// ids are preserved, so visits, watermarks and fingerprints stay attached.

interface LegacyRow {
  id: number
  kind: string
  display_name: string | null
  profile_path: string
}

// structure-preserving rebuild while child tables hold the rows
const migration004: CodeMigration = {
  foreignKeys: false,
  up(db: DatabaseSync): void {
    db.exec(`
      CREATE TABLE source_profiles_new (
        id            INTEGER PRIMARY KEY,
        browser       TEXT    NOT NULL,
        profile       TEXT    NOT NULL,
        kind          TEXT    NOT NULL,
        display_name  TEXT,
        profile_path  TEXT    NOT NULL,
        UNIQUE(browser, profile)
      );
    `)
    const insert = db.prepare('INSERT INTO source_profiles_new (id, browser, profile, kind, display_name, profile_path) VALUES (?, ?, ?, ?, ?, ?)')
    const rows = db.prepare('SELECT id, kind, display_name, profile_path FROM source_profiles').all() as unknown as LegacyRow[]
    for (const row of rows) {
      const { browser, profile } = identify(row)
      insert.run(row.id, browser, profile, row.kind, row.display_name, row.profile_path)
    }
    db.exec('DROP TABLE source_profiles')
    db.exec('ALTER TABLE source_profiles_new RENAME TO source_profiles')
  },
}

export default migration004

function identify(row: LegacyRow): { browser: string, profile: string } {
  switch (row.kind) {
    case 'chromium': {
      const match = chromiumPathMatch(row.profile_path)
      if (match !== null)
        return { browser: match.browser, profile: slugifyDir(match.dir) }
      break
    }
    case 'firefox':
      return { browser: 'firefox', profile: slugifyDir(path.basename(path.dirname(row.profile_path))) }
    case 'safari':
      return { browser: 'safari', profile: 'default' }
    case 'takeout':
      return { browser: 'takeout', profile: takeoutProfileKey(row.profile_path) }
  }
  // unmapped path: stay row-unique so the rebuild cannot collide;
  // that profile may re-ingest once with a discovered identity later
  return {
    browser: row.kind,
    profile: `${slugifyDir(path.basename(path.dirname(row.profile_path)))}-u${row.id}`,
  }
}

// reverse discovery: <dataRoot>/<userDir>/<dir>/History -> browser slug + dir
function chromiumPathMatch(profilePath: string): { browser: string, dir: string } | null {
  for (const app of CHROMIUM_BROWSERS) {
    for (const userDir of Object.values(app.userDirs ?? {})) {
      const marker = `/${userDir}/`
      const at = profilePath.indexOf(marker)
      if (at === -1) continue
      const dir = profilePath.slice(at + marker.length, profilePath.lastIndexOf('/'))
      return { browser: app.slug, dir }
    }
  }
  return null
}
