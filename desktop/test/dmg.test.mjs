import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readlinkSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

test('DMG contains a working app and Applications shortcut', { timeout: 60_000, skip: process.platform !== 'darwin' }, () => {
  const root = path.dirname(fileURLToPath(import.meta.url))
  const image = path.resolve(root, `../release/his-darwin-${process.arch}.dmg`)
  const mount = mkdtempSync(path.join(os.tmpdir(), 'his-dmg-test-'))
  let attached = false
  try {
    // mount and verify the image
    execFileSync('hdiutil', ['verify', image], { stdio: 'pipe', timeout: 30_000 })
    execFileSync('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, image], { stdio: 'pipe', timeout: 30_000 })
    attached = true
    assert.equal(readlinkSync(path.join(mount, 'Applications')), '/Applications')
    execFileSync(process.execPath, ['--test', path.join(root, 'package.test.mjs')], {
      env: { ...process.env, HIS_PACKAGED_APP: path.join(mount, 'his.app') }, stdio: 'pipe', timeout: 30_000,
    })
  } finally {
    if (attached) execFileSync('hdiutil', ['detach', mount], { stdio: 'pipe', timeout: 10_000 })
    rmSync(mount, { recursive: true, force: true })
  }
})
