import { cn } from 'cn'
import type { ComponentProps } from 'react'

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('animate-pulse rounded bg-bg-3', className)} />
}
