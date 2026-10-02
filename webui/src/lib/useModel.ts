import { useEffect, useState } from 'react'

export interface Subscribable {
  subscribe(): () => void
}

export function useModel<T extends object>(create: () => T): T {
  const [model] = useState(create)
  useEffect(() => {
    const m = model as Partial<Subscribable>
    if (typeof m.subscribe !== 'function') return
    const unsubscribe = m.subscribe()
    return typeof unsubscribe === 'function' ? unsubscribe : undefined
  }, [model])
  return model
}
