import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface SnapshotTarget {
  source: string
  profile: string
  displayName?: string
  dbPath: string
}

export interface SnapshotResult {
  path: string
  bytes: number
  via: 'copy-trio' | 'file-copy'
}

const SQLITE_SIDECARS = ['-wal', '-shm', '-journal']

export function snapshot(target: SnapshotTarget, home: string): SnapshotResult {
  const staging = stagingPath(home, target.source, target.profile)
  fs.mkdirSync(staging, { recursive: true })
  const snapshotPath = path.join(staging, path.basename(target.dbPath))

  if (isJson(target.dbPath)) {
    fs.copyFileSync(target.dbPath, snapshotPath)
    return { path: snapshotPath, bytes: fs.statSync(snapshotPath).size, via: 'file-copy' }
  }

  for (const ext of SQLITE_SIDECARS) {
    const sidecar = target.dbPath + ext
    if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, snapshotPath + ext)
  }
  fs.copyFileSync(target.dbPath, snapshotPath)
  foldJournals(snapshotPath)
  return { path: snapshotPath, bytes: fs.statSync(snapshotPath).size, via: 'copy-trio' }
}

export function stagingPath(home: string, source: string, profile: string): string {
  return path.join(home, 'staging', source, profile)
}

function isJson(dbPath: string): boolean {
  return dbPath.endsWith('.json')
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
