import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// --- contract ---

// The running instance keeps ~/.his/state.json; one home = one archive = one
// instance. Served by `his serve`, read by every command and the desktop
// shell — dead-PID files are pruned in place by any reader.
export interface InstanceState {
  pid: number
  port: number
  url: string
  db: string
  token?: string
}

export function defaultHome(): string {
  return process.env.HIS_HOME ?? path.join(os.homedir(), '.his')
}

export function stateFilePath(home: string): string {
  return path.join(home, 'state.json')
}

// --- read / write ---

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function readState(home: string): InstanceState | null {
  const file = stateFilePath(home)
  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
  const state = parseState(raw)
  if (state === null || !processAlive(state.pid)) {
    clearState(home)
    return null
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

function parseState(raw: string): InstanceState | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { pid, port, url, db, token } = parsed as Record<string, unknown>
  if (typeof pid !== 'number' || typeof port !== 'number' || typeof url !== 'string' || typeof db !== 'string') {
    return null
  }
  return { pid, port, url, db, token: typeof token === 'string' ? token : undefined }
}
