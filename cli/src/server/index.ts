import { historyDbPath, initDb } from '@his/core'
import { clearState, readState, writeState, type InstanceState } from '@his/core/state'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { createApp } from './app.ts'
import { createHandlers } from './handlers.ts'
import { createNodeHandler } from './node.ts'
import { RpcServer } from './rpc.ts'
import { SyncRunner } from './sync-runner.ts'
import { resolveDistRoot } from './static.ts'
import { startPeriodicSync, type PeriodicSyncHandle } from './watch.ts'

const HOST = '127.0.0.1'
const PORT_ATTEMPTS = 20

export interface ServeOptions {
  home: string
  port: number
  open?: boolean
  dist?: string
}

export interface ServeHandle {
  info: InstanceState
  done: Promise<void>
}

export type ServeResult =
  | { kind: 'started'; handle: ServeHandle }
  | { kind: 'already-running'; info: InstanceState }

export async function serve(options: ServeOptions): Promise<ServeResult> {
  const { home } = options
  const running = readState(home)
  if (running !== null)
    return { kind: 'already-running', info: running }

  const db = await initDb(historyDbPath(home))
  const distRoot = resolveDistRoot(options.dist ?? process.env.HIS_DIST)
  if (distRoot === null)
    console.error('his: webui dist not found — static routes will 503 (build webui or set HIS_DIST)')

  const app = createApp({ dist: distRoot })
  const server = http.createServer(createNodeHandler(app))
  const runner = new SyncRunner({ home })
  const rpc = new RpcServer(server, () => createHandlers({ db, runner }))

  let info: InstanceState
  try {
    const port = await bind(server, options.port)
    info = {
      pid: process.pid,
      port,
      url: `http://${HOST}:${port}/`,
      db: historyDbPath(home),
    }
    writeState(home, info)
  } catch (error) {
    db.close()
    throw error
  }

  const { promise: done, resolve: finish } = Promise.withResolvers<void>()

  let closing = false
  const shutdown = (): void => {
    if (closing) return
    closing = true
    process.removeListener('SIGINT', shutdown)
    process.removeListener('SIGTERM', shutdown)
    watch.stop()
    rpc.stop()
    server.closeAllConnections()
    server.close(() => {
      db.close()
      clearState(home)
      finish()
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Startup catch-up — async so serve returns early; the 6h interval
  // retries failures (which land on lastRun()).
  runner.trigger()
  const watch: PeriodicSyncHandle = startPeriodicSync(runner)

  if (options.open === true) openUrl(info.url)

  return { kind: 'started', handle: { info, done } }
}

// --- bind & lifecycle ---

async function bind(server: http.Server, startPort: number): Promise<number> {
  for (let offset = 0; offset < PORT_ATTEMPTS; offset += 1) {
    const port = startPort + offset
    if (await tryListen(server, port)) return port
  }
  throw new Error(`no free port in ${startPort}..${startPort + PORT_ATTEMPTS - 1}`)
}

function tryListen(server: http.Server, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const cleanup = (): void => {
      server.removeListener('error', onError)
      server.removeListener('listening', onListening)
    }
    const onError = (error: Error): void => {
      cleanup()
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') resolve(false)
      else reject(error)
    }
    const onListening = (): void => {
      cleanup()
      resolve(true)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, HOST)
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
