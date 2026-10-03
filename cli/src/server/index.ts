import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import { historyDbPath } from '../home.ts'
import {
  clearInstanceState,
  readInstanceState,
  writeInstanceState,
  type InstanceState,
} from './state.ts'

const HOST = '127.0.0.1'
const PORT_ATTEMPTS = 20

export interface ServeOptions {
  home: string
  port: number
  open?: boolean
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
  const running = readInstanceState(home)
  if (running !== undefined) return { kind: 'already-running', info: running }

  fs.mkdirSync(home, { recursive: true })

  const server = http.createServer((_req, res) => {
    res.writeHead(501, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('his serve: static + rpc land in later phases\n')
  })

  const port = await bind(server, options.port)
  const info: InstanceState = {
    pid: process.pid,
    port,
    url: `http://${HOST}:${port}/`,
    db: historyDbPath(home),
  }
  writeInstanceState(home, info)

  if (options.open === true) openUrl(info.url)

  let finish: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    finish = resolve
  })

  let closing = false
  const shutdown = (): void => {
    if (closing) return
    closing = true
    process.removeListener('SIGINT', shutdown)
    process.removeListener('SIGTERM', shutdown)
    server.closeAllConnections()
    server.close(() => {
      clearInstanceState(home)
      finish()
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return { kind: 'started', handle: { info, done } }
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
  spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
}