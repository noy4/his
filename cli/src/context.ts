import { defaultHome } from '@his/core'

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
    const ctx = { home: opts.home ?? defaultHome() }
    return fn(ctx, ...args)
  }
}
