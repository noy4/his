import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('rounded-lg border bg-bg-2 p-4', className)} />
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted">{children}</h2>
  )
}
