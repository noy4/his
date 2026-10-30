import { historyDbPath, initDb } from '@his/core/node'
import { clearState, writeState, type InstanceState } from '@his/core/state'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import { createApp } from './app.ts'
import { createHandlers } from './handlers.ts'
import { createNodeHandler } from './node.ts'
import { RpcServer } from './rpc.ts'
import { SyncRunner } from './sync-runner.ts'

export { resolveDistRoot } from './static.ts'

const HOST = '127.0.0.1'
const PORT_ATTEMPTS = 20

export interface ServeOptions {
  home: string
  port: number
  dist: string | null
}

export interface HisServer {
  instance: InstanceState
  close(): Promise<void>
}

export async function createServer(options: ServeOptions): Promise<HisServer> {
  const { home } = options
  const db = await initDb(historyDbPath(home))

  // Fresh token per start, injected into the WebUI
  const token = randomBytes(32).toString('base64url')
  const app = createApp({ dist: options.dist, token })
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
  } catch (error) {
    await db.destroy()
    throw error
  }

  // Origins need the bound port, so RPC is wired after bind
  const rpc = new RpcServer(server, createHandlers({ db, runner, home }), {
    allowedOrigins: allowedOrigins(instance.port),
    token,
  })

  // startup catch-up
  runner.trigger()
  const stopSchedule = runner.schedule()

  let closed: Promise<void> | null = null
  const close = (): Promise<void> => {
    if (closed !== null) return closed
    const { promise, resolve } = Promise.withResolvers<void>()
    closed = promise
    stopSchedule()
    rpc.stop()
    server.closeAllConnections()
    server.close(() => {
      db.destroy().finally(() => {
        clearState(home)
        resolve()
      })
    })
    return promise
  }

  try {
    writeState(home, instance)
  } catch (error) {
    await close()
    throw error
  }

  return { instance, close }
}

// --- networking ---

function allowedOrigins(port: number): string[] {
  return [`http://${HOST}:${port}`, `http://localhost:${port}`]
}

async function bind(server: http.Server, startPort: number): Promise<number> {
  for (let offset = 0; offset < PORT_ATTEMPTS; offset += 1) {
    const port = startPort + offset
    if (await tryListen(server, port)) {
      const address = server.address()
      if (address !== null && typeof address !== 'string') return address.port
      throw new Error('server address unavailable')
    }
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
