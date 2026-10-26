import assert from 'node:assert/strict'
import http from 'node:http'
import { describe, it } from 'node:test'
import { WebSocket } from 'ws'
import { RpcServer } from '../rpc.ts'

const TOKEN = 'test-token'

interface Harness {
  wsUrl: string
  origin: string
  stop(): Promise<void>
}

async function startServer(): Promise<Harness> {
  const server = http.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  const origin = `http://127.0.0.1:${port}`
  const rpc = new RpcServer(server, { 'history.stats': () => ({ ok: true }) }, {
    allowedOrigins: [origin],
    token: TOKEN,
  })
  return {
    wsUrl: `ws://127.0.0.1:${port}/rpc`,
    origin,
    async stop() {
      rpc.stop()
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

function withServer(run: (h: Harness) => Promise<void>): Promise<void> {
  return startServer().then(async (h) => {
    try {
      await run(h)
    } finally {
      await h.stop()
    }
  })
}

function connect(url: string, origin?: string): Promise<WebSocket> {
  const ws = new WebSocket(url, origin === undefined ? {} : { headers: { origin } })
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
    ws.once('unexpected-response', (_request, response) => reject(new Error(`status ${response.statusCode}`)))
  })
}

describe('RpcServer gate', () => {
  it('drops a path other than /rpc', () =>
    withServer(async (h) => {
      const other = `${h.wsUrl.replace('/rpc', '/nope')}?token=${TOKEN}`
      await assert.rejects(connect(other, h.origin))
    }))

  it('returns 403 for a foreign Origin', () =>
    withServer(async (h) => {
      await assert.rejects(connect(`${h.wsUrl}?token=${TOKEN}`, 'http://evil.example'), /status 403/)
    }))

  it('returns 403 without a token', () =>
    withServer(async (h) => {
      await assert.rejects(connect(h.wsUrl, h.origin), /status 403/)
    }))

  it('returns 403 for a wrong token', () =>
    withServer(async (h) => {
      await assert.rejects(connect(`${h.wsUrl}?token=nope`, h.origin), /status 403/)
    }))

  it('accepts an allowed Origin with the token', () =>
    withServer(async (h) => {
      const ws = await connect(`${h.wsUrl}?token=${TOKEN}`, h.origin)
      assert.equal(ws.readyState, WebSocket.OPEN)
      ws.close()
    }))

  it('accepts a missing Origin with the token', () =>
    withServer(async (h) => {
      const ws = await connect(`${h.wsUrl}?token=${TOKEN}`)
      assert.equal(ws.readyState, WebSocket.OPEN)
      ws.close()
    }))

  it('serves a call once accepted', () =>
    withServer(async (h) => {
      const ws = await connect(`${h.wsUrl}?token=${TOKEN}`, h.origin)
      const result = await new Promise((resolve, reject) => {
        ws.once('message', (data) => resolve(JSON.parse(String(data)).result))
        ws.once('error', reject)
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'history.stats' }))
      })
      assert.deepEqual(result, { ok: true })
      ws.close()
    }))
})
