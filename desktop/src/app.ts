import { BrowserWindow, dialog, shell, Tray, type App } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { defaultHome } from '@his/core/paths'
import { readState, type InstanceState } from '@his/core/state'
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
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    // The window only ever shows the local WebUI: links go to the OS browser.
    window.webContents.setWindowOpenHandler(({ url }) => {
      openExternal(url)
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, url) => {
      if (isLocalUrl(url)) return
      event.preventDefault()
      openExternal(url)
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
    if (this.#quitting) throw new Error('his is quitting')
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
    const packaged = this.app.isPackaged
    const cliEntry = process.env.HIS_CLI ?? (packaged
      ? path.join(process.resourcesPath, 'cli', 'dist', 'bin.mjs')
      : path.join(import.meta.dirname, '../../cli/bin.ts'))
    // keep stdin open: the server exits when the app is gone.
    const env: NodeJS.ProcessEnv = { ...process.env, HIS_EXIT_ON_STDIN_CLOSE: '1' }
    if (packaged) env.ELECTRON_RUN_AS_NODE = '1'
    const proc = spawn(packaged ? process.execPath : 'node', [cliEntry, 'serve'], { stdio: ['pipe', 'ignore', 'pipe'], env })
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
    this.#serveProc = undefined
    if (proc === undefined || proc.exitCode !== null || proc.signalCode !== null) return
    // stop only the child started by this app
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => proc.kill('SIGKILL'), 3_000)
      proc.once('exit', () => { clearTimeout(timer); resolve() })
      proc.once('error', () => { clearTimeout(timer); resolve() })
      if (!proc.kill('SIGTERM')) { clearTimeout(timer); resolve() }
    })
  }
}

// The served WebUI is the only page the window may show.
function isLocalUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'http:' && (hostname === '127.0.0.1' || hostname === 'localhost')
  } catch {
    return false
  }
}

// Hand http(s) pages to the OS browser; ignore every other scheme.
function openExternal(url: string): void {
  let protocol: string
  try {
    protocol = new URL(url).protocol
  } catch {
    return
  }
  if (protocol === 'http:' || protocol === 'https:') void shell.openExternal(url)
}
