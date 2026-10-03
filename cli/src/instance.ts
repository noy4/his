import fs from 'node:fs'
import { stateFilePath } from './home.ts'

export interface InstanceState {
  pid: number
  port: number
  url: string
  db: string
  token?: string
}

export function readInstanceState(home: string): InstanceState | undefined {
  const file = stateFilePath(home)
  if (!fs.existsSync(file)) return undefined
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<InstanceState>
    if (typeof state.pid !== 'number' || typeof state.port !== 'number' || typeof state.url !== 'string' || typeof state.db !== 'string') {
      throw new Error('incomplete state')
    }
    return state as InstanceState
  } catch {
    clearInstanceState(home)
    return undefined
  }
}

export function writeInstanceState(home: string, state: InstanceState): void {
  fs.writeFileSync(stateFilePath(home), `${JSON.stringify(state, null, 2)}\n`)
}

export function clearInstanceState(home: string): void {
  fs.rmSync(stateFilePath(home), { force: true })
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function status(home: string): number {
  const state = readInstanceState(home)
  if (state === undefined) return 1
  if (!processAlive(state.pid)) {
    clearInstanceState(home)
    return 1
  }
  console.log(JSON.stringify({ url: state.url, db: state.db, pid: state.pid }, null, 2))
  return 0
}

export function stop(home: string): number {
  const state = readInstanceState(home)
  if (state === undefined || !processAlive(state.pid)) {
    clearInstanceState(home)
    return 1
  }
  process.kill(state.pid, 'SIGTERM')
  clearInstanceState(home)
  console.log(`his: sent SIGTERM to pid ${state.pid}`)
  return 0
}