import { readState } from './server/state.ts'

export function status(home: string): void {
  const state = readState(home)
  if (state === null) throw new Error('no running instance — run "his serve" first')
  console.log(JSON.stringify({ url: state.url, db: state.db, pid: state.pid }, null, 2))
}

export function stop(home: string): void {
  const state = readState(home)
  if (state === null) throw new Error('no running instance — nothing to stop')
  process.kill(state.pid, 'SIGTERM')
  console.log(`his: sent SIGTERM to pid ${state.pid}`)
}
