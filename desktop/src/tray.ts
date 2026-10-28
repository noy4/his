import { Menu, Tray, nativeImage } from 'electron'
import path from 'node:path'
import type { SyncSummary } from '@his/core'
import type { HisApp } from './app.ts'
import { callRpc } from './rpc.ts'

// Menubar tray: Sync Now (RPC), Open, Quit his. HisApp owns the instance.
export function createTray(host: HisApp): Tray {
  const icon = nativeImage.createFromPath(path.join(import.meta.dirname, '../assets/trayTemplate@2x.png'))
  icon.setTemplateImage(true)
  const tray = new Tray(icon)
  tray.setToolTip('his')

  let syncing = false
  async function syncNow(): Promise<void> {
    if (syncing) return
    syncing = true
    try {
      const state = await host.ensureServe()
      const base = state.url.endsWith('/') ? state.url : `${state.url}/`
      const wsUrl = `${base.replace(/^http:/, 'ws:')}rpc?token=${encodeURIComponent(state.token ?? '')}`
      const result = await callRpc<SyncSummary>(wsUrl, 'sync.run')
      if (!result) throw new Error('Invalid sync response')
      if (result.failures) throw new Error(result.errors.join('\n') || 'Sync failed')
    } catch (error) {
      host.showError('Unable to sync his', error)
    } finally {
      syncing = false
    }
  }

  const menu = Menu.buildFromTemplate([
    { label: 'Sync Now', click: () => syncNow() },
    { label: 'Open', click: () => host.openWindow() },
    { type: 'separator' },
    { label: 'Quit his', click: () => host.quit() },
  ])
  tray.setContextMenu(menu)

  return tray
}
