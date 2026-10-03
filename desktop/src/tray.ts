import { Menu, Tray, nativeImage } from 'electron'
import path from 'node:path'
import type { HisApp } from './app.ts'

// Menubar tray: Sync Now (RPC), Open, Quit his. HisApp owns the instance.
export function createTray(host: HisApp): Tray {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/trayTemplate@2x.png'))
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
      await runSyncRpc(wsUrl)
    } catch {
      // stay silent — tooltip is static
    } finally {
      syncing = false
    }
  }

  const menu = Menu.buildFromTemplate([
    { label: 'Sync Now', click: () => void syncNow() },
    { label: 'Open', click: () => void host.openWindow() },
    { type: 'separator' },
    { label: 'Quit his', click: () => host.quit() },
  ])
  tray.setContextMenu(menu)

  return tray
}

// --- sync over RPC ---

const SYNC_TIMEOUT = 30_000

async function runSyncRpc(wsUrl: string): Promise<void> {
  if (typeof WebSocket === 'undefined') throw new Error('WebSocket unavailable in this Electron')
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('sync timeout'))
    }, SYNC_TIMEOUT)

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sync.run' }))
    })
    ws.addEventListener('message', (event) => {
      let message: { id?: number; error?: { message?: string } }
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (message.error !== undefined) {
        clearTimeout(timeout)
        ws.close()
        reject(new Error(message.error.message))
      } else if (message.id === 1) {
        clearTimeout(timeout)
        ws.close()
        resolve()
      }
    })
    ws.addEventListener('error', () => {
      clearTimeout(timeout)
      reject(new Error('/rpc unreachable'))
    })
    ws.addEventListener('close', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}
