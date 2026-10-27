import { IconToggleGroup, type IconToggleOption } from '@/components/ui/toggle-group'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { fmtNum } from '@/lib/format'
import ListIcon from '~icons/mdi/format-list-bulleted'
import GridIcon from '~icons/mdi/view-grid-outline'

export function ItemsToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('mb-2 flex flex-wrap items-center gap-1.5', className)}
    />
  )
}

export function ItemsGroupRoot({ className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={cn('mb-2', className)} />
}

export function ItemsGroupTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      {...props}
      className={cn('sticky -top-4 z-10 bg-bg-2 py-1 text-xs font-semibold text-muted', className)}
    />
  )
}

const VIEW_OPTIONS: IconToggleOption[] = [
  { value: 'list', label: 'List', Icon: ListIcon },
  { value: 'card', label: 'Cards', Icon: GridIcon },
]

export function ItemsViewToggle({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <IconToggleGroup
      aria-label="View"
      value={value}
      onChange={onChange}
      options={VIEW_OPTIONS}
    />
  )
}

export function EmptyMessage({ text, className, ...props }: Omit<ComponentProps<'p'>, 'children'> & { text: string }) {
  return (
    <p
      {...props}
      className={cn('py-6 text-center text-sm text-muted', className)}
    >
      {text}
    </p>
  )
}

export function LoadMoreButton({ children = 'Show more', className, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className={cn('mt-2 w-full rounded py-1.5 text-sm text-muted hover:bg-bg-3 hover:text-text', className)}
    >
      {children}
    </button>
  )
}

export function VisitCount({ n }: { n: number }) {
  return (
    <span
      title="visit count"
      className="shrink-0 font-mono text-xs text-muted tabular-nums"
    >
      {fmtNum(n)}
    </span>
  )
}
