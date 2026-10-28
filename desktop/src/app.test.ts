import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, mock, test } from 'node:test'
import type { App } from 'electron'

const errors: string[] = []
let menu: { label?: string; click?: () => void }[] = []
let loadError: Error | undefined
mock.module('electron', {
  namedExports: {
    BrowserWindow: class {
      webContents = { getURL: () => '' }
      on(): void {}
      show(): void {}
      async loadURL(): Promise<void> { if (loadError) throw loadError }
    },
    Tray: class {
      setToolTip(): void {}
      setContextMenu(): void {}
    },
    Menu: { buildFromTemplate: (items: typeof menu) => { menu = items; return items } },
    nativeImage: { createFromPath: () => ({ setTemplateImage() {} }) },
    dialog: { showErrorBox: (_title: string, message: string) => errors.push(message) },
  },
})
const { HisApp } = await import('./app.ts')
const originalEnv = { ...process.env }
let dir: string

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'his-desktop-test-'))
  process.env.HIS_HOME = dir
})

after(() => {
  process.env = originalEnv
  fs.rmSync(dir, { recursive: true, force: true })
})

test('rejects on a missing Node executable and allows retry', async () => {
  const app = new HisApp({} as App)
  process.env.PATH = dir
  errors.length = 0
  await assert.rejects(app.ensureServe(), /Could not start his serve:.*ENOENT/)
  await assert.rejects(app.ensureServe(), /Could not start his serve:.*ENOENT/)
  assert.equal(errors.length, 0)
  process.env.PATH = originalEnv.PATH
})

test('reports CLI stderr on early exit', async () => {
  const app = new HisApp({} as App)
  process.env.HIS_CLI = path.join(dir, 'missing-cli.js')
  errors.length = 0
  await assert.rejects(app.ensureServe(), /missing-cli\.js/)
  assert.equal(errors.length, 0)
})

test('terminates a process that times out', async () => {
  const app = new HisApp({} as App)
  const cli = path.join(dir, 'waiting.cjs')
  const pidFile = path.join(dir, 'waiting.pid')
  fs.writeFileSync(cli, `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000)`)
  process.env.HIS_CLI = cli
  errors.length = 0
  await assert.rejects(app.ensureServe(500), /did not start in time/)
  assert.equal(errors.length, 0)
  const pid = Number(fs.readFileSync(pidFile, 'utf8'))
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.fail('timed-out process is still alive')
})

test('openWindow reports a server startup failure', async () => {
  process.env.PATH = dir
  errors.length = 0
  await new HisApp({} as App).openWindow()
  assert.match(errors[0]!, /ENOENT/)
  process.env.PATH = originalEnv.PATH
})

test('openWindow reports a failed window load', async () => {
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    pid: process.pid, port: 4477, url: 'http://127.0.0.1:4477', db: 'test.db',
  }))
  const app = new HisApp({} as App)
  errors.length = 0
  loadError = new Error('page failed to load')
  await app.openWindow()
  assert.deepEqual(errors, ['page failed to load'])
  loadError = undefined
})

test('start and Sync Now report startup failures', async () => {
  fs.rmSync(path.join(dir, 'state.json'))
  process.env.PATH = dir
  errors.length = 0
  const app = new HisApp({} as App)
  app.start()
  for (let attempt = 0; errors.length === 0 && attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.match(errors[0]!, /ENOENT/)
  menu.find((item) => item.label === 'Sync Now')!.click!()
  for (let attempt = 0; errors.length < 2 && attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.match(errors[1]!, /ENOENT/)
  process.env.PATH = originalEnv.PATH
})
