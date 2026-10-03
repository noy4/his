import fs from 'node:fs'
import { stateFilePath } from '../home.ts'

export interface InstanceState {
  pid: number
  port: number
  url: string
  db: string
  token?: string
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function readState(home: string): InstanceState | undefined {
  const file = stateFilePath(home)
  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
  const state = parseState(raw)
  if (state === undefined || !processAlive(state.pid)) {
    clearState(home)
    return undefined
  }
  return state
}

export function writeState(home: string, state: InstanceState): void {
  const file = stateFilePath(home)
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`)
  fs.renameSync(tmp, file)
}

export function clearState(home: string): void {
  fs.rmSync(stateFilePath(home), { force: true })
}

function parseState(raw: string): InstanceState | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const { pid, port, url, db, token } = parsed as Record<string, unknown>
  if (typeof pid !== 'number' || typeof port !== 'number' || typeof url !== 'string' || typeof db !== 'string') {
    return undefined
  }
  return { pid, port, url, db, token: typeof token === 'string' ? token : undefined }
}