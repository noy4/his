import fs from 'node:fs'

const SQLITE_SIDECARS = ['-wal', '-shm', '-journal']

// mtime/size probe of the target's source files (main + sidecars, or the
// takeout json) serialized for cross-run comparison.
export function probeFingerprint(dbPath: string): string {
  const files = dbPath.endsWith('.json')
    ? [dbPath]
    : [dbPath, ...SQLITE_SIDECARS.map((ext) => dbPath + ext)]
  return JSON.stringify(files.map(statEntry))
}

function statEntry(file: string): [number, number] {
  try {
    const stats = fs.statSync(file, { throwIfNoEntry: false })
    return stats === undefined ? [0, -1] : [stats.mtimeMs, stats.size]
  } catch {
    return [0, -1]
  }
}
