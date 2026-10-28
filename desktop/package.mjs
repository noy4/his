import { packager } from '@electron/packager'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { version } = require('electron/package.json')
const { version: appVersion } = require('./package.json')
const temp = await mkdtemp(path.join(os.tmpdir(), 'his-desktop-package-'))

try {
  // stage only runtime files
  const app = path.join(temp, 'app')
  const cli = path.join(temp, 'cli')
  await cp(path.join(root, 'dist'), path.join(app, 'dist'), { recursive: true })
  await cp(path.join(root, 'assets'), path.join(app, 'assets'), { recursive: true })
  await cp(path.join(root, '../cli/dist'), path.join(cli, 'dist'), { recursive: true })
  await writeFile(path.join(app, 'package.json'), JSON.stringify({ name: 'his', version: appVersion, type: 'module', main: 'dist/main.js' }))

  // create an unsigned local app
  const paths = await packager({
    dir: app,
    name: 'his',
    platform: 'darwin',
    arch: process.arch,
    electronVersion: version,
    out: path.join(root, 'release'),
    overwrite: true,
    extraResource: [cli],
    prune: false,
  })
  console.log(paths.join('\n'))
} finally {
  await rm(temp, { recursive: true, force: true })
}
