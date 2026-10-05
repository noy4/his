import { resolveHome } from './home.ts'

export interface Context {
  home: string
}

interface CliOptions {
  home?: string
}

export function withCtx<A extends unknown[]>(
  fn: (ctx: Context, ...args: A) => void | Promise<void>,
): (...args: A) => void | Promise<void> {
  return (...args: A) => {
    const opts = args.at(-1) as CliOptions
    const ctx = { home: resolveHome(opts.home) }
    return fn(ctx, ...args)
  }
}
