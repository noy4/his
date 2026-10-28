import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

test('packed CLI works outside the workspace', { timeout: 60_000 }, async () => {
  // isolate environment
  const dir = mkdtempSync(path.join(os.tmpdir(), 'his-pack-'))
  const home = path.join(dir, 'home')
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, XDG_CONFIG_HOME: dir, APPDATA: dir, HIS_HOME: home }
  delete env.HIS_DIST
  delete env.NODE_PATH
  delete env.NODE_OPTIONS
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  let server
  try {
    // pack and install
    execFileSync(pnpm, ['pack', '--pack-destination', dir], { env, stdio: 'pipe' })
    const tarball = readdirSync(dir).find((name) => name.endsWith('.tgz'))
    assert.ok(tarball, 'package tarball missing')
    execFileSync(npm, ['install', '--prefix', dir, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', path.join(dir, tarball)], { env, stdio: 'pipe' })
    const installed = path.join(dir, 'node_modules', '@his', 'cli')
    const manifest = JSON.parse(readFileSync(path.join(installed, 'package.json'), 'utf8'))
    const bin = path.join(installed, manifest.bin.his)
    assert.deepEqual(manifest.dependencies ?? {}, {})
    const run = (...args) => execFileSync(process.execPath, [bin, ...args], { cwd: dir, env, encoding: 'utf8' })

    // sync and query
    assert.match(run('--version'), /his\/\d/)
    mkdirSync(path.join(home, 'takeout'), { recursive: true })
    writeFileSync(path.join(home, 'takeout', 'history.json'), JSON.stringify([
      { url: 'https://example.com/pack-test', title: 'Pack test', time: 1700000000000 },
    ]))
    run('sync', '--target', 'takeout')
    const page = JSON.parse(run('query', '--url', 'https://example.com/pack-test'))
    assert.equal(page.items.length, 1)
    assert.equal(page.items[0].url, 'https://example.com/pack-test')

    // start server
    server = spawn(process.execPath, [bin, 'serve'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    server.stderr.on('data', (chunk) => { output += chunk })
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`server startup timed out: ${output}`)), 10_000)
      server.stdout.on('data', (chunk) => {
        output += chunk
        const match = /his: serving (http:\/\/\S+)/.exec(output)
        if (match) { clearTimeout(timer); resolve(match[1]) }
      })
      server.once('error', (error) => { clearTimeout(timer); reject(error) })
      server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited ${code}: ${output}`)) })
    })
    // check webui and stop
    const response = await fetch(url)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /<div id="root">/)
    assert.equal(JSON.parse(run('status')).url, url)
    const exited = once(server, 'exit')
    run('stop')
    const [code] = await Promise.race([
      exited,
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('server shutdown timed out')), 10_000)
        timer.unref()
      }),
    ])
    assert.equal(code, 0)
  } finally {
    // clean up
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = once(server, 'exit')
      server.kill('SIGKILL')
      await exited
    }
    rmSync(dir, { recursive: true, force: true })
  }
})
