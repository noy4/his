import os from 'node:os'
import path from 'node:path'

export function resolveHome(homeArg: string | undefined): string {
  return homeArg ?? process.env.HIS_HOME ?? path.join(os.homedir(), '.his')
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