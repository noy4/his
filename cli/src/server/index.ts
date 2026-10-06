import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import { historyDbPath, initDb } from '@his/core'
import { createApp } from './app.ts'
import { createNodeHandler } from './node.ts'
import { attachRpc, type RpcHandle } from './rpc.ts'
import { startPeriodicSync, type PeriodicSyncHandle } from './watch.ts'
import { resolveDistRoot } from './static.ts'
import { clearState, readState, writeState, type InstanceState } from '@his/core/state'

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

  fs.mkdirSync(home, { recursive: true })

  const db = await initDb(historyDbPath(home))
  const token = randomBytes(24).toString('base64url')

  const distRoot = resolveDistRoot(options.dist ?? process.env.HIS_DIST)
  if (distRoot === null)
    console.error('his: webui dist not found — static routes will 503 (build webui or set HIS_DIST)')

  const app = createApp({
    dist: distRoot,
  })
  const server = http.createServer(createNodeHandler(app))
  const rpc: RpcHandle = attachRpc(server, { db, home, token })

  const port = await bind(server, options.port)
  const info: InstanceState = {
    pid: process.pid,
    port,
    url: `http://${HOST}:${port}/`,
    db: historyDbPath(home),
    token,
  }
  writeState(home, info)

  // Startup catch-up — recover what accumulated while serve was closed
  // (sources keep ~90 days, so nothing is lost in between).
  const runner = rpc.runner()
  if (!runner.isRunning()) {
    try {
      await runner.run({})
    } catch {
      // the 6h interval check picks the backlog up anyway
    }
  }
  const watch: PeriodicSyncHandle = startPeriodicSync({ runner })

  if (options.open === true) openUrl(info.url)

  let finish: () => void = () => { }
  const done = new Promise<void>((resolve) => {
    finish = resolve
  })

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
  spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
}
