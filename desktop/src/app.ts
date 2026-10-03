import { BrowserWindow, type App } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { defaultHome, readState, type InstanceState } from '@his/core/state'
import { createTray } from './tray.ts'

// --- context ---

// The application context: the desktop shell owns no logic — it spawns
// `his serve` and attaches through the state file (pid / port / url / token)
// that serve publishes. Window and tray hang on this context.
export class HisApp {
  readonly app: App
  #win: BrowserWindow | null = null
  #quitting = false
  #serveProc: ChildProcess | undefined

  constructor(app: App) {
    this.app = app
  }

  // --- lifecycle ---

  start(): void {
    this.app.dock?.hide()
    createTray(this)
    void this.openWindow()
  }

  // Quitting goes only through here: stop serve first, then exit for real
  // (app.exit bypasses before-quit, so the external preventDefault fires once).
  quit(): void {
    this.#quitting = true
    void this.#stopServe().finally(() => this.app.exit(0))
  }

  // --- window ---

  async openWindow(): Promise<void> {
    if (this.#win === null) this.#win = this.#createWindow()
    const state = await this.ensureServe()
    if (this.#win.webContents.getURL() !== state.url) void this.#win.loadURL(state.url)
    this.#win.show()
  }

  #createWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 1000,
      height: 680,
      show: false,
      title: 'his',
    })
    window.on('close', (event) => {
      if (!this.#quitting) {
        // Menubar behavior: closing the window hides it, quitting goes through the tray.
        event.preventDefault()
        window.hide()
      }
    })
    return window
  }

  // --- host surface for the tray ---

  getState(): InstanceState | null {
    return readState(defaultHome())
  }

  // Tray actions respawn serve when it is down (spec).
  async ensureServe(timeoutMs = 10_000): Promise<InstanceState> {
    const existing = readState(defaultHome())
    if (existing !== null) return existing
    this.#spawnServe()
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const state = readState(defaultHome())
      if (state !== null) return state
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('his serve did not come up — check the CLI entry')
  }

  // --- serve controller ---

  #spawnServe(): ChildProcess {
    const cliEntry = process.env.HIS_CLI ?? path.join(__dirname, '../../cli/bin.ts')
    const proc = spawn('node', [cliEntry, 'serve'], { stdio: 'ignore', env: process.env })
    proc.on('exit', () => {
      if (this.#serveProc === proc) this.#serveProc = undefined
    })
    this.#serveProc = proc
    return proc
  }

  async #stopServe(): Promise<void> {
    const proc = this.#serveProc
    const pid = readState(defaultHome())?.pid
    this.#serveProc = undefined
    if (proc === undefined && pid === undefined) return
    if (pid !== undefined) process.kill(pid, 'SIGTERM')
    await new Promise<void>((resolve) => {
      const deadline = Date.now() + 3_000
      const check = (): void => {
        if (pid === undefined || !isAliveish(pid)) return resolve()
        if (Date.now() > deadline) {
          process.kill(pid, 'SIGKILL')
          return resolve()
        }
        setTimeout(check, 100)
      }
      check()
    })
  }
}

// post-SIGTERM the state file is gone, so liveness needs a raw probe here
function isAliveish(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
