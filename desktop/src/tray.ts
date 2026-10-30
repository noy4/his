import { Menu, Tray, nativeImage, shell, app, type MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import type { SyncSummary } from '@his/core'
import type { HisApp } from './app.ts'
import { dev } from './dev.ts'
import { callRpc } from './rpc.ts'
import { isNewer, latestRelease, type Release } from './update.ts'

// Menubar tray
export function createTray(host: HisApp): Tray {
  return new TrayController(host).tray
}

class TrayController {
  readonly tray: Tray
  readonly #host: HisApp
  #syncing = false
  #updateAvailable: Release | null = null

  constructor(host: HisApp) {
    this.#host = host
    const icon = nativeImage.createFromPath(path.join(import.meta.dirname, '../assets', trayIconFile(dev)))
    icon.setTemplateImage(true)
    this.tray = new Tray(icon)
    this.tray.setToolTip('his')

    this.#refresh()
    this.#checkForUpdate()
  }

  // Rebuild the menu; the update item only appears once a newer release is found.
  #refresh(): void {
    const items: MenuItemConstructorOptions[] = [
      { label: 'Open', click: () => this.#host.openWindow() },
      { label: 'Open in Browser', click: () => this.#host.openInBrowser() },
      { label: 'Sync Now', click: () => this.#syncNow() },
      { type: 'separator' },
    ]
    if (this.#updateAvailable) {
      const { version, url } = this.#updateAvailable
      items.push(
        { label: `New version available — v${version}`, click: () => { shell.openExternal(url) } },
      )
    }
    items.push({ label: 'Quit his', click: () => this.#host.quit() })
    this.tray.setContextMenu(Menu.buildFromTemplate(items))
  }

  // Checked at launch and every 12 h.
  #checkForUpdate(): void {
    const check = async (): Promise<void> => {
      const release = await latestRelease()
      if (!release || !isNewer(release.version, app.getVersion())) return
      if (this.#updateAvailable?.version === release.version) return
      this.#updateAvailable = release
      this.#refresh()
    }
    check()
    setInterval(check, 12 * 60 * 60 * 1000).unref()
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

export function trayIconFile(dev: boolean): string {
  return dev ? 'trayTemplate-dev@2x.png' : 'trayTemplate@2x.png'
}
