const RPC_TIMEOUT = 30_000

export async function callRpc<T>(wsUrl: string, method: string, params?: unknown): Promise<T> {
  if (typeof WebSocket === 'undefined') throw new Error('WebSocket unavailable')
  const ws = new WebSocket(wsUrl)
  let timeout: ReturnType<typeof setTimeout>
  try {
    return await new Promise<T>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('RPC timeout')), RPC_TIMEOUT)
      ws.addEventListener('open', () => {
        try {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }))
        } catch (error) {
          reject(error)
        }
      })
      ws.addEventListener('message', (event) => {
        let message: { id?: number; error?: { message?: string }; result?: T } | null
        try {
          message = JSON.parse(String(event.data))
        } catch {
          return
        }
        if (message === null || typeof message !== 'object' || message.id !== 1) return
        if (message.error !== undefined) {
          reject(new Error(message.error?.message))
        } else if (!Object.hasOwn(message, 'result')) {
          reject(new Error('Invalid RPC response'))
        } else {
          resolve(message.result as T)
        }
      })
      ws.addEventListener('error', () => reject(new Error('RPC connection error')))
      ws.addEventListener('close', () => reject(new Error('RPC connection closed')))
    })
  } finally {
    clearTimeout(timeout!)
    ws.close()
  }
}
