import { cn } from 'cn'
import type { ComponentProps } from 'react'

export function ToggleChip({ selected = false, className, ...props }: ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={selected}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        selected
          ? 'border-primary bg-primary-soft text-primary'
          : 'text-muted hover:text-text',
        className,
      )}
    />
  )
}
