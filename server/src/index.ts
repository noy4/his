import { historyDbPath, initDb } from '@his/core/node'
import { clearState, readState, writeState, type InstanceState } from '@his/core/state'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import { createApp } from './app.ts'
import { createHandlers } from './handlers.ts'
import { createNodeHandler } from './node.ts'
import { RpcServer } from './rpc.ts'
import { SyncRunner } from './sync-runner.ts'
import { resolveDistRoot } from './static.ts'

const HOST = '127.0.0.1'
const PORT_ATTEMPTS = 20

export interface ServeOptions {
  home: string
  port: number
  open?: boolean
  dist?: string
}

export type ServeResult =
  | { kind: 'started'; instance: InstanceState; done: Promise<void> }
  | { kind: 'already-running'; instance: InstanceState }

export async function serve(options: ServeOptions): Promise<ServeResult> {
  const { home } = options
  const running = readState(home)
  if (running !== null)
    return { kind: 'already-running', instance: running }

  const db = await initDb(historyDbPath(home))
  const distRoot = resolveDistRoot(options.dist ?? process.env.HIS_DIST)
  if (distRoot === null)
    console.error('his: webui dist not found — static routes will 503 (build webui or set HIS_DIST)')

  // Fresh token per start, injected into the WebUI
  const token = randomBytes(32).toString('base64url')
  const app = createApp({ dist: distRoot, token })
  const server = http.createServer(createNodeHandler(app.fetch))
  const runner = new SyncRunner({ home })

  let instance: InstanceState
  try {
    const port = await bind(server, options.port)
    instance = {
      pid: process.pid,
      port,
      url: `http://${HOST}:${port}/`,
      db: historyDbPath(home),
      token,
    }
    writeState(home, instance)
  } catch (error) {
    await db.destroy()
    throw error
  }

  // Origins need the bound port, so RPC is wired after bind
  const rpc = new RpcServer(server, () => createHandlers({ db, runner, home }), {
    allowedOrigins: allowedOrigins(instance.port),
    token,
  })

  const { promise: done, resolve: finish } = Promise.withResolvers<void>()

  let closing = false
  const shutdown = (): void => {
    if (closing) return
    closing = true
    process.removeListener('SIGINT', shutdown)
    process.removeListener('SIGTERM', shutdown)
    stopSchedule()
    rpc.stop()
    server.closeAllConnections()
    server.close(() => {
      db.destroy().finally(() => {
        clearState(home)
        finish()
      })
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Startup catch-up — async so serve returns early; the 6h interval
  // retries failures (which land on lastRun()).
  runner.trigger()
  const stopSchedule = runner.schedule()

  if (options.open === true) openUrl(instance.url)

  return { kind: 'started', instance, done }
}

// --- bind & lifecycle ---

function allowedOrigins(port: number): string[] {
  return [`http://${HOST}:${port}`, `http://localhost:${port}`]
}

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
