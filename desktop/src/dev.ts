import { app } from 'electron'
import { defaultHome } from '@his/core/paths'

export const dev = !app.isPackaged

// Unpackaged runs (`electron .`) are sandboxed away from the installed app.
export function sandboxDev(): void {
  if (!dev) return
  app.setPath('userData', `${app.getPath('userData')}-dev`)
  process.env.HIS_HOME ||= defaultHome({ dev: true })
}
