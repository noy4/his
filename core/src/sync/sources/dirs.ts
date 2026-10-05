import fs from 'node:fs'

// list subdirectories of a browser data dir, skipping unreadable ones —
// one locked or permission-denied dir must not abort the whole discovery
export function listDirs(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}
