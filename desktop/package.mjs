import { packager } from '@electron/packager'
import { execFileSync } from 'node:child_process'
import { cp, lstat, mkdtemp, open, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { version } = require('electron/package.json')
const { version: appVersion } = require('./package.json')
// Mach-O magic numbers, read as big-endian.
const MACH_O_MAGIC = new Set([0xfeedface, 0xfeedfacf, 0xcffaedfe, 0xcefaedfe])
const temp = await mkdtemp(path.join(os.tmpdir(), 'his-desktop-package-'))

try {
  // stage only runtime files
  const app = path.join(temp, 'app')
  const cli = path.join(temp, 'cli')
  await cp(path.join(root, 'dist'), path.join(app, 'dist'), { recursive: true })
  await cp(path.join(root, 'assets'), path.join(app, 'assets'), { recursive: true })
  await cp(path.join(root, '../cli/dist'), path.join(cli, 'dist'), { recursive: true })
  await writeFile(path.join(app, 'package.json'), JSON.stringify({ name: 'his', version: appVersion, type: 'module', main: 'dist/main.js' }))

  // create a local app and ad-hoc sign it
  const paths = await packager({
    dir: app,
    name: 'his',
    appBundleId: 'com.noy4.his',
    icon: path.join(root, 'assets', 'icon.icns'),
    platform: 'darwin',
    arch: process.arch,
    electronVersion: version,
    out: path.join(root, 'release'),
    overwrite: true,
    extraResource: [cli],
    prune: false,
  })
  await signAdHoc(path.join(paths[0], 'his.app'))
  console.log(paths.join('\n'))
} finally {
  await rm(temp, { recursive: true, force: true })
}

async function isMachO(file) {
  if (!(await lstat(file)).isFile()) return false
  const handle = await open(file, 'r')
  try {
    const { buffer } = await handle.read(Buffer.alloc(4), 0, 4, 0)
    return buffer.length === 4 && MACH_O_MAGIC.has(buffer.readUInt32BE(0))
  } finally {
    await handle.close()
  }
}

async function machOFiles(dir) {
  const found = []
  for (const entry of await readdir(dir)) {
    const file = path.join(dir, entry)
    if (await isMachO(file)) found.push(file)
  }
  return found
}

// Electron ships linker-signed binaries without a resource seal, so Gatekeeper
// reports the bundle as damaged. Ad-hoc signing every nested binary bottom-up
// downgrades that to an unidentified developer the user can allow.
async function signAdHoc(app) {
  const frameworks = path.join(app, 'Contents', 'Frameworks')
  const targets = []
  for (const name of await readdir(frameworks)) {
    const entry = path.join(frameworks, name)
    if (name.endsWith('.framework')) {
      targets.push(...await machOFiles(path.join(entry, 'Versions', 'A')), entry)
    } else if (name.endsWith('.app')) {
      targets.push(...await machOFiles(path.join(entry, 'Contents', 'MacOS')), entry)
    } else if (name.endsWith('.dylib')) {
      targets.push(entry)
    }
  }
  targets.push(...await machOFiles(path.join(app, 'Contents', 'MacOS')), app)

  for (const target of targets) {
    execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', target], { stdio: 'pipe' })
  }
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
}
