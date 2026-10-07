import { serve } from './server/index.ts'
import type { Context } from './context.ts'

const DEFAULT_PORT = 4477

export interface ServeOptions {
  port?: string
  open?: boolean
}

export async function serveCommand(ctx: Context, opts: ServeOptions): Promise<void> {
  const port = parsePortArg(opts.port)
  if (port === null) throw new Error(`invalid --port: ${opts.port} (integer 1-65535)`)
  const result = await serve({ home: ctx.home, port, open: opts.open })
  if (result.kind === 'already-running') {
    console.log(result.instance.url)
    return
  }
  console.log(`his: serving ${result.instance.url}`)
  console.log(`his: archive ${result.instance.db}`)
  await result.done
}

function parsePortArg(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_PORT
  if (!/^\d+$/.test(raw)) return null
  const port = Number(raw)
  return port >= 1 && port <= 65535 ? port : null
}