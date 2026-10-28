import { Menu, Tray, nativeImage } from 'electron'
import path from 'node:path'
import type { SyncSummary } from '@his/core'
import type { HisApp } from './app.ts'
import { callRpc } from './rpc.ts'

// Menubar tray
export function createTray(host: HisApp): Tray {
  return new TrayController(host).tray
}

class TrayController {
  readonly tray: Tray
  readonly #host: HisApp
  #syncing = false

  constructor(host: HisApp) {
    this.#host = host
    const icon = nativeImage.createFromPath(path.join(import.meta.dirname, '../assets/trayTemplate@2x.png'))
    icon.setTemplateImage(true)
    this.tray = new Tray(icon)
    this.tray.setToolTip('his')

    const menu = Menu.buildFromTemplate([
      { label: 'Sync Now', click: () => this.#syncNow() },
      { label: 'Open', click: () => this.#host.openWindow() },
      { type: 'separator' },
      { label: 'Quit his', click: () => this.#host.quit() },
    ])
    this.tray.setContextMenu(menu)
  }

  async #syncNow(): Promise<void> {
    if (this.#syncing) return
    this.#syncing = true
    try {
      const state = await this.#host.ensureServe()
      const base = state.url.endsWith('/') ? state.url : `${state.url}/`
      const wsUrl = `${base.replace(/^http:/, 'ws:')}rpc?token=${encodeURIComponent(state.token ?? '')}`
      const result = await callRpc<SyncSummary>(wsUrl, 'sync.run')
      if (!result) throw new Error('Invalid sync response')
      if (result.failures) throw new Error(result.errors.join('\n') || 'Sync failed')
    } catch (error) {
      this.#host.showError('Unable to sync his', error)
    } finally {
      this.#syncing = false
    }
  }
}
