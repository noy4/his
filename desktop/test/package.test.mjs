import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

test('packaged app runs without a checkout or system Node', { timeout: 30_000, skip: process.platform !== 'darwin' }, async () => {
  const root = path.dirname(fileURLToPath(import.meta.url))
  const dir = mkdtempSync(path.join(os.tmpdir(), 'his-desktop-test-'))
  const resources = path.join(dir, 'his.app/Contents/Resources')
  const executable = path.join(resources, '../MacOS/his')
  const cli = path.join(resources, 'cli/dist/bin.mjs')
  const home = path.join(dir, 'home')
  const env = { ...process.env, HOME: dir, HIS_HOME: home, PATH: dir }
  delete env.HIS_CLI
  delete env.HIS_DIST
  delete env.NODE_PATH
  delete env.NODE_OPTIONS
  delete env.ELECTRON_RUN_AS_NODE
  let app
  let serverPid
  try {
    cpSync(process.env.HIS_PACKAGED_APP ?? path.resolve(root, `../release/his-darwin-${process.arch}/his.app`), path.join(dir, 'his.app'), { recursive: true, verbatimSymlinks: true })
    // sync and query the bundled cli
    execFileSync(executable, ['-e', `require('node:fs').accessSync(${JSON.stringify(path.join(resources, 'app.asar/assets/trayTemplate@2x.png'))})`], {
      cwd: dir, env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 10_000,
    })
    mkdirSync(path.join(home, 'takeout'), { recursive: true })
    writeFileSync(path.join(home, 'takeout/history.json'), JSON.stringify([
      { url: 'https://example.com/desktop-test', title: 'Desktop test', time: 1700000000000 },
    ]))
    const run = (...args) => execFileSync(executable, [cli, ...args], {
      cwd: dir, env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 10_000,
    })
    run('sync', '--target', 'takeout')
    assert.equal(JSON.parse(run('query', '--url', 'https://example.com/desktop-test')).items.length, 1)

    // start the app and check its webui
    app = spawn(executable, [], { cwd: dir, env, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    app.stderr.on('data', (chunk) => { stderr += chunk })
    const statePath = path.join(home, 'state.json')
    const deadline = Date.now() + 10_000
    while (!existsSync(statePath) && Date.now() < deadline && app.exitCode === null) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert.ok(existsSync(statePath), `app did not start its server: ${stderr}`)
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    serverPid = state.pid
    const response = await fetch(state.url, { signal: AbortSignal.timeout(5_000) })
    assert.equal(response.status, 200)
    assert.match(await response.text(), /<div id="root">/)
  } finally {
    // clean up both processes
    if (serverPid) {
      try { process.kill(serverPid, 'SIGTERM') } catch {}
    }
    if (app && app.exitCode === null && app.signalCode === null) {
      const exited = once(app, 'exit')
      app.kill('SIGTERM')
      await exited
    }
    rmSync(dir, { recursive: true, force: true })
  }
})
