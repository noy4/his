import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') throw new Error('DMG creation requires macOS')

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'release', `his-darwin-${process.arch}.dmg`)
const temp = await mkdtemp(path.join(os.tmpdir(), 'his-dmg-'))
try {
  // stage the app and Applications shortcut
  await cp(path.join(root, 'release', `his-darwin-${process.arch}`, 'his.app'), path.join(temp, 'his.app'), { recursive: true, verbatimSymlinks: true })
  await symlink('/Applications', path.join(temp, 'Applications'))
  execFileSync('hdiutil', ['create', '-ov', '-volname', 'his', '-srcfolder', temp, '-format', 'UDZO', output], { stdio: 'inherit' })
} finally {
  await rm(temp, { recursive: true, force: true })
}
