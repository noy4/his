import { createServer, resolveDistRoot } from '@his/server'
import { readState } from '@his/core/state'
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

  const running = readState(ctx.home)
  if (running !== null) {
    console.log(running.url)
    return
  }

  const dist = resolveDistRoot(process.env.HIS_DIST)
  const server = await createServer({ home: ctx.home, port, dist })
  if (dist === null)
    console.error('his: webui dist not found — static routes will 503 (build webui or set HIS_DIST)')
  console.log(`his: serving ${server.instance.url}`)
  console.log(`his: archive ${server.instance.db}`)
  if (opts.open) openUrl(server.instance.url)

  await waitForShutdown()
  await server.close()
}

function parsePortArg(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_PORT
  if (!/^\d+$/.test(raw)) return null
  const port = Number(raw)
  return port >= 1 && port <= 65535 ? port : null
}

// Resolves on SIGINT/SIGTERM, or when the app that started us goes away.
// stdin-close is opt-in, because stdin may already be closed (`stdio: 'ignore'` and `< /dev/null` read EOF immediately).
function waitForShutdown(): Promise<void> {
  return new Promise<void>((resolve) => {
    const stop = (): void => {
      process.removeListener('SIGINT', stop)
      process.removeListener('SIGTERM', stop)
      process.stdin.removeListener('end', stop)
      process.stdin.removeListener('close', stop)
      resolve()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    if (process.env.HIS_EXIT_ON_STDIN_CLOSE === '1') {
      process.stdin.once('end', stop)
      process.stdin.once('close', stop)
      process.stdin.resume()
    }
  })
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
