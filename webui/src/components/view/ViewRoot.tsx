import type { ReactNode } from 'react'

export function ViewRoot({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-10">
      {children}
    </div>
  )
}
