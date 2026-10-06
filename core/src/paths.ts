import os from 'node:os'
import path from 'node:path'

// home layout: everything under one home dir

export function defaultHome(): string {
  return process.env.HIS_HOME ?? path.join(os.homedir(), '.his')
}

export function stateFilePath(home: string): string {
  return path.join(home, 'state.json')
}

export function historyDbPath(home: string): string {
  return path.join(home, 'history.db')
}

export function takeoutDir(home: string): string {
  return path.join(home, 'takeout')
}
