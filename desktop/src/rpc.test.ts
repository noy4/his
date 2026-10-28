import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { callRpc } from './rpc.ts'

const originalWebSocket = globalThis.WebSocket
const sockets: Socket[] = []

class Socket extends EventTarget {
  sent = ''
  closed = false
  url: string

  constructor(url: string) {
    super()
    this.url = url
    sockets.push(this)
  }

  send(data: string): void { this.sent = data }
  close(): void { this.closed = true; this.dispatchEvent(new Event('close')) }
  message(data: unknown): void { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })) }
}

beforeEach(() => { sockets.length = 0; globalThis.WebSocket = Socket as unknown as typeof WebSocket })
afterEach(() => { globalThis.WebSocket = originalWebSocket })

test('calls a method with params and returns its result', async () => {
  const result = callRpc<boolean>('ws://localhost/rpc', 'example.run', { value: 1 })
  const socket = sockets[0]!
  assert.equal(socket.url, 'ws://localhost/rpc')
  socket.dispatchEvent(new Event('open'))
  assert.deepEqual(JSON.parse(socket.sent), { jsonrpc: '2.0', id: 1, method: 'example.run', params: { value: 1 } })
  socket.message({ id: 2, result: true })
  socket.message({ id: 1, result: false })
  assert.equal(await result, false)
  assert.equal(socket.closed, true)
})

test('accepts null results and omits absent params', async () => {
  const result = callRpc<null>('ws://localhost/rpc', 'example.run')
  const socket = sockets[0]!
  socket.dispatchEvent(new Event('open'))
  assert.deepEqual(JSON.parse(socket.sent), { jsonrpc: '2.0', id: 1, method: 'example.run' })
  socket.message({ id: 1, result: null })
  assert.equal(await result, null)
  assert.equal(socket.closed, true)
})

test('rejects RPC errors and malformed responses', async () => {
  let result = callRpc('ws://localhost/rpc', 'example.run')
  sockets[0]!.message({ id: 1, error: { message: 'failed' } })
  await assert.rejects(result, /failed/)
  assert.equal(sockets[0]!.closed, true)

  result = callRpc('ws://localhost/rpc', 'example.run')
  sockets[1]!.message({ id: 1 })
  await assert.rejects(result, /Invalid RPC response/)
  assert.equal(sockets[1]!.closed, true)
})

test('rejects disconnects and timeouts', async (t) => {
  let result = callRpc('ws://localhost/rpc', 'example.run')
  sockets[0]!.dispatchEvent(new Event('close'))
  await assert.rejects(result, /RPC connection closed/)
  assert.equal(sockets[0]!.closed, true)

  t.mock.timers.enable({ apis: ['setTimeout'] })
  result = callRpc('ws://localhost/rpc', 'example.run')
  t.mock.timers.tick(30_000)
  await assert.rejects(result, /RPC timeout/)
  assert.equal(sockets[1]!.closed, true)
})
