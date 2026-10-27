import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { snapshotDir } from '../../paths.ts'
import type { SyncTarget } from '../sources/types.ts'

export interface SnapshotResult {
  path: string
  bytes: number
  via: 'vacuum-into' | 'copy-trio' | 'file-copy'
}

const SQLITE_SIDECARS = ['-wal', '-shm', '-journal']

export function snapshot(target: SyncTarget, home: string): SnapshotResult {
  const dir = snapshotDir(home, target.browser, target.profile)
  fs.mkdirSync(dir, { recursive: true })
  const snapshotPath = path.join(dir, path.basename(target.sourcePath))

  if (isJson(target.sourcePath)) {
    fs.copyFileSync(target.sourcePath, snapshotPath)
    return { path: snapshotPath, bytes: fs.statSync(snapshotPath).size, via: 'file-copy' }
  }

  const via = vacuumInto(target.sourcePath, snapshotPath) ?? copyTrio(target.sourcePath, snapshotPath)
  return { path: snapshotPath, bytes: fs.statSync(snapshotPath).size, via }
}

function isJson(sourcePath: string): boolean {
  return sourcePath.endsWith('.json')
}

// Primary route: read the source through SQLite itself and serialize the
// current content — used pages only, WAL folded, no torn copy. Null means
// "fall back to the file trio" (missing file, permissions, version skew,
// read-only shm init failing on a hot WAL).
function vacuumInto(source: string, dest: string): SnapshotResult['via'] | null {
  if (!fs.existsSync(source)) return null
  const tmp = dest + '.vacuum-tmp'
  try {
    fs.rmSync(tmp, { force: true })
    const db = new DatabaseSync(source, { readOnly: true })
    try {
      db.exec(`VACUUM INTO '${tmp.replaceAll("'", "''")}'`)
    } finally {
      db.close()
    }
  } catch {
    fs.rmSync(tmp, { force: true })
    return null
  }
  fs.renameSync(tmp, dest)
  for (const ext of SQLITE_SIDECARS) fs.rmSync(dest + ext, { force: true })
  return 'vacuum-into'
}

function copyTrio(source: string, dest: string): SnapshotResult['via'] {
  for (const ext of SQLITE_SIDECARS) {
    const sidecar = source + ext
    if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, dest + ext)
  }
  fs.copyFileSync(source, dest)
  foldJournals(dest)
  return 'copy-trio'
}

function foldJournals(copyPath: string): void {
  const db = new DatabaseSync(copyPath)
  db.exec('PRAGMA journal_mode = DELETE')
  db.close()
  for (const ext of SQLITE_SIDECARS) {
    const sidecar = copyPath + ext
    if (fs.existsSync(sidecar) && fs.statSync(sidecar).size === 0) fs.rmSync(sidecar)
  }
}
