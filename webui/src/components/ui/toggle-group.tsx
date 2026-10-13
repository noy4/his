import { cn } from 'cn'
import type { ComponentProps } from 'react'

export function ToggleGroupRoot({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="group"
      {...props}
      className={cn('inline-flex shrink-0 gap-0.5 rounded-sm bg-bg-3 p-0.5', className)}
    />
  )
}

export function ToggleGroupItem({ selected = false, className, ...props }: ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={selected}
      className={cn(
        'rounded p-1 transition-colors',
        selected
          ? 'bg-bg-2 text-text'
          : 'text-muted hover:text-text',
        className,
      )}
    />
  )
}
