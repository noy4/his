import { readState } from './server/state.ts'

export function status(home: string): number {
  const state = readState(home)
  if (state === null) return 1
  console.log(JSON.stringify({ url: state.url, db: state.db, pid: state.pid }, null, 2))
  return 0
}

export function stop(home: string): number {
  const state = readState(home)
  if (state === null) return 1
  process.kill(state.pid, 'SIGTERM')
  console.log(`his: sent SIGTERM to pid ${state.pid}`)
  return 0
}