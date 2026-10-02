import { useEffect, useState } from 'react'

export interface Subscribable {
  subscribe(): () => void
}

export function useModel<T extends object>(create: () => T): T {
  const [model] = useState(create)
  useEffect(() => {
    const subscribe = (model as Partial<Subscribable>).subscribe
    if (typeof subscribe !== 'function') return
    const unsubscribe = (subscribe as () => void | (() => void))()
    return typeof unsubscribe === 'function' ? unsubscribe : undefined
  }, [model])
  return model
}
