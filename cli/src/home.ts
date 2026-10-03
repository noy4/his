import path from 'node:path'
import { defaultHome } from '@his/core'

export function resolveHome(homeArg: string | undefined): string {
  return homeArg ?? defaultHome()
}

export function historyDbPath(home: string): string {
  return path.join(home, 'history.db')
}

export function faviconsDbPath(home: string): string {
  return path.join(home, 'favicons.db')
}

export function takeoutDir(home: string): string {
  return path.join(home, 'takeout')
}

export function stateFilePath(home: string): string {
  return path.join(home, 'state.json')
}