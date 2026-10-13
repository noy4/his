import { cn } from 'cn'
import type { ComponentProps } from 'react'
import type { IconComponent } from '@/components/icons'

export type IconToggleOption<T extends string = string> = {
  value: T
  label: string
  Icon: IconComponent
}

export function IconToggleGroup<T extends string>({
  value,
  onChange,
  options,
  ...props
}: Omit<ComponentProps<'div'>, 'children' | 'value' | 'onChange'> & {
  value: T
  onChange: (next: T) => void
  options: readonly IconToggleOption<T>[]
}) {
  return (
    <ToggleGroupRoot {...props}>
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          title={o.label}
          aria-label={o.label}
          selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          <o.Icon width={14} height={14} />
        </ToggleGroupItem>
      ))}
    </ToggleGroupRoot>
  )
}

// --- components ---

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
