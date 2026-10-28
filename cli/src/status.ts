import { readState } from '@his/core/state'
import type { Context } from './context.ts'

export function status(ctx: Context): void {
  const state = readState(ctx.home)
  if (state === null) throw new Error('no running instance — run "his serve" first')
  console.log(JSON.stringify({ url: state.url, db: state.db, pid: state.pid }, null, 2))
}
