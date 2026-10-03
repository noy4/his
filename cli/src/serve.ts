import { serve } from './server/index.ts'

const DEFAULT_PORT = 4477

export interface ServeOptions {
  home: string
  port?: string
  open?: boolean
}

export async function serveCommand(opts: ServeOptions): Promise<number> {
  const port = parsePortArg(opts.port)
  if (port === null) {
    console.error(`invalid --port: ${opts.port} (integer 1-65535)`)
    return 1
  }
  const result = await serve({ home: opts.home, port, open: opts.open })
  if (result.kind === 'already-running') {
    console.log(result.info.url)
    return 0
  }
  const { info, done } = result.handle
  console.log(`his: serving ${info.url}`)
  console.log(`his: archive ${info.db}`)
  await done
  return 0
}

function parsePortArg(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_PORT
  if (!/^\d+$/.test(raw)) return null
  const port = Number(raw)
  return port >= 1 && port <= 65535 ? port : null
}