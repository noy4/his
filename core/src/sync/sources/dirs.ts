import fs from 'node:fs'

// list subdirectories, skipping unreadable dirs
export function listDirs(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

// filesystem dir to the slug used in profile keys
export function dirToProfileName(dir: string): string {
  return dir.replace(/[^A-Za-z0-9._-]+/g, '-')
}
