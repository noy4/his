import { BrowserWindow, dialog, Tray, type App } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { defaultHome } from '@his/core/paths'
import { processAlive, readState, type InstanceState } from '@his/core/state'
import { createTray } from './tray.ts'

export class HisApp {
  readonly app: App
  #win: BrowserWindow | null = null
  #tray: Tray | null = null
  #quitting = false
  #serveProc: ChildProcess | undefined
  #booting: Promise<InstanceState> | null = null

  constructor(app: App) {
    this.app = app
  }

  // --- lifecycle ---

  start(): void {
    this.app.dock?.hide()
    this.#tray = createTray(this)
    // this.openWindow()
    // spawn serve at boot
    this.ensureServe().catch((error) => this.showError('Unable to start his', error))
  }

  // Quit funnel: destroy tray, stop serve, exit (app.exit bypasses before-quit).
  quit(): void {
    this.#quitting = true
    this.#tray?.destroy()
    this.#tray = null
    this.#stopServe().finally(() => this.app.exit(0))
  }

  // --- window ---

  async openWindow(): Promise<void> {
    try {
      if (this.#win === null) this.#win = this.#createWindow()
      const state = await this.ensureServe()
      if (this.#win.webContents.getURL() !== state.url) await this.#win.loadURL(state.url)
      this.#win.show()
    } catch (error) {
      this.showError('Unable to open his', error)
    }
  }

  showError(title: string, error: unknown): void {
    if (!this.#quitting)
      dialog.showErrorBox(title, error instanceof Error ? error.message : String(error))
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

  // Tray actions respawn serve when it is down (spec).
  async ensureServe(timeoutMs = 10_000): Promise<InstanceState> {
    const existing = readState(defaultHome())
    if (existing !== null) return existing
    // single-flight: 'Open' clicked during startup reuses the running boot
    this.#booting ??= this.#bootServe(timeoutMs).finally(() => {
      this.#booting = null
    })
    return this.#booting
  }

  async #bootServe(timeoutMs: number): Promise<InstanceState> {
    const proc = this.#spawnServe()
    return new Promise((resolve, reject) => {
      // capture stderr and clean up listeners
      let stderr = ''
      const onData = (chunk: Buffer): void => { stderr = (stderr + chunk.toString()).slice(-4096) }
      const cleanup = (): void => {
        clearInterval(interval)
        clearTimeout(timeout)
        proc.stderr?.off('data', onData)
        proc.off('error', onError)
        proc.off('close', onExit)
      }
      // detect startup failures
      const onError = (error: Error): void => {
        cleanup()
        reject(new Error(`Could not start his serve: ${error.message}`))
      }
      const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
        cleanup()
        const detail = stderr.trim()
        reject(new Error(`his serve exited (${signal ?? `code ${code}`}).${detail ? `\n\n${detail}` : ''}`))
      }
      proc.stderr?.on('data', onData)
      proc.once('error', onError)
      proc.once('close', onExit)

      // wait for server state
      const interval = setInterval(() => {
        try {
          const state = readState(defaultHome())
          if (state !== null) {
            cleanup()
            proc.stderr?.resume()
            resolve(state)
          }
        } catch (error) {
          cleanup()
          proc.kill()
          reject(error)
        }
      }, 100)

      // stop stalled startup
      const timeout = setTimeout(() => {
        cleanup()
        proc.kill()
        reject(new Error('his serve did not start in time. Check the CLI entry and try again.'))
      }, timeoutMs)
    })
  }

  // --- serve controller ---

  #spawnServe(): ChildProcess {
    const cliEntry = process.env.HIS_CLI ?? path.join(import.meta.dirname, '../../cli/bin.ts')
    const proc = spawn('node', [cliEntry, 'serve'], { stdio: ['ignore', 'ignore', 'pipe'], env: process.env })
    const onEnd = () => {
      if (this.#serveProc === proc) this.#serveProc = undefined
    }
    proc.on('error', onEnd)
    proc.on('exit', onEnd)
    this.#serveProc = proc
    return proc
  }

  async #stopServe(): Promise<void> {
    const proc = this.#serveProc
    const pid = readState(defaultHome())?.pid
    this.#serveProc = undefined
    if (proc === undefined && pid === undefined) return
    if (pid !== undefined) process.kill(pid, 'SIGTERM')
    // post-SIGTERM the state file is gone, so probe liveness directly
    await new Promise<void>((resolve) => {
      const deadline = Date.now() + 3_000
      const check = (): void => {
        if (pid === undefined || !processAlive(pid)) return resolve()
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
