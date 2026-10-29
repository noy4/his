import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, mock, test } from 'node:test'
import type { App } from 'electron'

const errors: string[] = []
const openedUrls: string[] = []
const appPaths: Record<string, string> = { userData: '/tmp/his-ud' }
let menu: { label?: string; click?: () => void }[] = []
let loadError: Error | undefined
let openHandler: ((details: { url: string }) => { action: string }) | undefined
let navigateHandler: ((event: { preventDefault(): void }, url: string) => void) | undefined
mock.module('electron', {
  namedExports: {
    app: {
      isPackaged: false,
      getPath: (name: string) => appPaths[name]!,
      setPath: (name: string, value: string) => { appPaths[name] = value },
    },
    BrowserWindow: class {
      webContents = {
        getURL: () => '',
        setWindowOpenHandler: (handler: typeof openHandler) => { openHandler = handler },
        on: (event: string, handler: typeof navigateHandler) => {
          if (event === 'will-navigate') navigateHandler = handler
        },
      }
      on(): void {}
      show(): void {}
      async loadURL(): Promise<void> { if (loadError) throw loadError }
    },
    shell: { openExternal: (url: string) => { openedUrls.push(url); return Promise.resolve() } },
    Tray: class {
      setToolTip(): void {}
      setContextMenu(): void {}
      destroy(): void {}
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

test('packaged server uses the bundled runtime without Node on PATH', async () => {
  const cli = path.join(dir, 'packaged.cjs')
  fs.writeFileSync(cli, `if (process.env.ELECTRON_RUN_AS_NODE !== '1') process.exit(1); require('node:fs').writeFileSync(require('node:path').join(process.env.HIS_HOME, 'state.json'), JSON.stringify({ pid: process.pid, port: 4477, url: 'http://127.0.0.1:4477', db: 'test.db' })); setInterval(() => {}, 1000)`)
  process.env.HIS_CLI = cli
  process.env.PATH = dir
  const app = new HisApp({ isPackaged: true } as App)
  const state = await app.ensureServe()
  assert.notEqual(state.pid, process.pid)
  process.kill(state.pid, 'SIGTERM')
  fs.rmSync(path.join(dir, 'state.json'))
  process.env.PATH = originalEnv.PATH
})

test('quit leaves an existing server running', async () => {
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    pid: process.pid, port: 4477, url: 'http://127.0.0.1:4477', db: 'test.db',
  }))
  let exit!: () => void
  const exited = new Promise<void>((resolve) => { exit = resolve })
  const app = new HisApp({ exit } as unknown as App)
  assert.equal((await app.ensureServe()).pid, process.pid)
  app.quit()
  await exited
  assert.ok(fs.existsSync(path.join(dir, 'state.json')))
  fs.rmSync(path.join(dir, 'state.json'))
})

test('quit stops the child while it is starting', async () => {
  const cli = path.join(dir, 'starting.cjs')
  const pidFile = path.join(dir, 'starting.pid')
  fs.writeFileSync(cli, `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000)`)
  process.env.HIS_CLI = cli
  let exit!: () => void
  const exited = new Promise<void>((resolve) => { exit = resolve })
  const app = new HisApp({ exit } as unknown as App)
  const boot = assert.rejects(app.ensureServe(), /his serve exited/)
  for (let attempt = 0; !fs.existsSync(pidFile) && attempt < 50; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert.ok(fs.existsSync(pidFile))
  const pid = Number(fs.readFileSync(pidFile, 'utf8'))
  app.quit()
  await Promise.all([exited, boot])
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
  await assert.rejects(app.ensureServe(), /his is quitting/)
})

test('quit stops its own running server', async () => {
  const cli = path.join(dir, 'running.cjs')
  fs.writeFileSync(cli, `require('node:fs').writeFileSync(require('node:path').join(process.env.HIS_HOME, 'state.json'), JSON.stringify({ pid: process.pid, port: 4477, url: 'http://127.0.0.1:4477', db: 'test.db' })); setInterval(() => {}, 1000)`)
  process.env.HIS_CLI = cli
  let exit!: () => void
  const exited = new Promise<void>((resolve) => { exit = resolve })
  const app = new HisApp({ exit } as unknown as App)
  const state = await app.ensureServe()
  app.quit()
  await exited
  assert.throws(() => process.kill(state.pid, 0), { code: 'ESRCH' })
  fs.rmSync(path.join(dir, 'state.json'))
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

test('window shows only the local UI and hands external links to the OS browser', async () => {
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    pid: process.pid, port: 4477, url: 'http://127.0.0.1:4477', db: 'test.db',
  }))
  const app = new HisApp({} as App)
  await app.openWindow()
  openedUrls.length = 0

  assert.deepEqual(openHandler!({ url: 'https://example.com' }), { action: 'deny' })
  assert.deepEqual(openedUrls, ['https://example.com'])

  assert.deepEqual(openHandler!({ url: 'file:///etc/passwd' }), { action: 'deny' })
  assert.deepEqual(openedUrls, ['https://example.com'])

  let prevented = false
  navigateHandler!({ preventDefault: () => { prevented = true } }, 'https://example.com/next')
  assert.equal(prevented, true)
  assert.deepEqual(openedUrls, ['https://example.com', 'https://example.com/next'])

  prevented = false
  navigateHandler!({ preventDefault: () => { prevented = true } }, 'http://127.0.0.1:4477/visits')
  assert.equal(prevented, false)
  assert.deepEqual(openedUrls, ['https://example.com', 'https://example.com/next'])
})

test('dev runs are sandboxed from the installed app', async () => {
  const { dev, sandboxDev } = await import('./dev.ts')
  assert.equal(dev, true)
  const home = process.env.HIS_HOME
  sandboxDev()
  assert.equal(appPaths.userData, '/tmp/his-ud-dev')
  // an explicit HIS_HOME is not overridden
  assert.equal(process.env.HIS_HOME, home)
})

test('the tray icon marks unpackaged runs', async () => {
  const { trayIconFile } = await import('./tray.ts')
  assert.equal(trayIconFile(false), 'trayTemplate@2x.png')
  assert.equal(trayIconFile(true), 'trayTemplate-dev@2x.png')
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

test('Sync Now reports target errors and unexpected disconnects', async () => {
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    pid: process.pid, port: 4477, url: 'http://127.0.0.1:4477', db: 'test.db', token: 'test',
  }))
  const originalWebSocket = globalThis.WebSocket
  let response: object | null = { id: 1, result: {
    startedAt: 1, finishedAt: 2, attempted: 1, failures: 1, skipped: 0,
    insertedVisits: 0, touchedUrls: 0, errors: ['Safari: Permission denied'],
  } }
  class Socket extends EventTarget {
    constructor() {
      super()
      queueMicrotask(() => this.dispatchEvent(new Event('open')))
    }
    send(): void {
      queueMicrotask(() => this.dispatchEvent(response === null
        ? new Event('close')
        : new MessageEvent('message', { data: JSON.stringify(response) })))
    }
    close(): void { this.dispatchEvent(new Event('close')) }
  }
  globalThis.WebSocket = Socket as unknown as typeof WebSocket
  try {
    errors.length = 0
    new HisApp({} as App).start()
    const sync = menu.find((item) => item.label === 'Sync Now')!.click!
    sync()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(errors, ['Safari: Permission denied'])
    response = null
    sync()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(errors[1], 'RPC connection closed')
  } finally {
    globalThis.WebSocket = originalWebSocket
    fs.rmSync(path.join(dir, 'state.json'))
  }
})
