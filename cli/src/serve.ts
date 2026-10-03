import { serve } from './server/index.ts'

const DEFAULT_PORT = 4477

export interface ServeOptions {
  home: string
  port?: string
  open?: boolean
}

export async function serveCommand(opts: ServeOptions): Promise<void> {
  const port = parsePortArg(opts.port)
  if (port === null) throw new Error(`invalid --port: ${opts.port} (integer 1-65535)`)
  const result = await serve({ home: opts.home, port, open: opts.open })
  if (result.kind === 'already-running') {
    console.log(result.info.url)
    return
  }
  const { info, done } = result.handle
  console.log(`his: serving ${info.url}`)
  console.log(`his: archive ${info.db}`)
  await done
}

function parsePortArg(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_PORT
  if (!/^\d+$/.test(raw)) return null
  const port = Number(raw)
  return port >= 1 && port <= 65535 ? port : null
}