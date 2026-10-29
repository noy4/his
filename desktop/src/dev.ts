import { app } from 'electron'
import os from 'node:os'
import path from 'node:path'

export const dev = !app.isPackaged

// Unpackaged runs (`electron .`) are sandboxed away from the installed app.
export function sandboxDev(): void {
  if (!dev) return
  app.setPath('userData', `${app.getPath('userData')}-dev`)
  process.env.HIS_HOME ||= path.join(os.homedir(), '.his-dev')
}
