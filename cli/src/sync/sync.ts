import type { Context } from '../context.ts'
import type { SyncOptions } from './types.ts'
import { runSync } from './runSync.ts'

export function sync(ctx: Context, opts: SyncOptions): void {
  const summary = runSync(ctx.home, opts, {
    onLog: (line) => console.log(line),
    onError: (line) => console.error(line),
  })
  if (summary.failures > 0) {
    throw new Error(`sync failed for ${summary.failures} of ${summary.attempted} targets`)
  }
}
