import { resolveDistRoot, serve } from '@his/server'
import { spawn } from 'node:child_process'
import type { Context } from './context.ts'

const DEFAULT_PORT = 4477

export interface ServeOptions {
  port?: string
  open?: boolean
}

export async function serveCommand(ctx: Context, opts: ServeOptions): Promise<void> {
  const port = parsePortArg(opts.port)
  if (port === null)
    throw new Error(`invalid --port: ${opts.port} (integer 1-65535)`)

  const dist = resolveDistRoot(process.env.HIS_DIST)
  const result = await serve({
    home: ctx.home,
    port,
    dist,
  })
  if (result.kind === 'already-running') {
    console.log(result.instance.url)
    return
  }
  if (dist === null)
    console.error('his: webui dist not found — static routes will 503 (build webui or set HIS_DIST)')
  console.log(`his: serving ${result.instance.url}`)
  console.log(`his: archive ${result.instance.db}`)
  if (opts.open) openUrl(result.instance.url)
  await result.done
}

function parsePortArg(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_PORT
  if (!/^\d+$/.test(raw)) return null
  const port = Number(raw)
  return port >= 1 && port <= 65535 ? port : null
}

function openUrl(url: string): void {
  // Best effort — a missing opener falls back to printing the URL.
  const [cmd, args] = process.platform === 'win32'
    ? ['cmd', ['/c', 'start', '', url]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]]
  spawn(cmd, args, { detached: true, stdio: 'ignore' })
    .on('error', () => console.error(`his: could not open a browser — visit ${url}`))
    .unref()
}
