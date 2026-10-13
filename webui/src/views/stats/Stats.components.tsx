import dayjs from 'dayjs'
import ChevronLeft from '~icons/mdi/chevron-left'
import ChevronRight from '~icons/mdi/chevron-right'
import type { ComponentProps, ReactNode } from 'react'
import type { IconComponent } from '@/components/icons'
import { buttonBase } from '@/components/ui/button'
import { ToggleGroupItem, ToggleGroupRoot } from '@/components/ui/toggle-group'
import { fmtNum } from '@/lib/format'

export function StatsHeaderRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      {children}
    </div>
  )
}

export function StatsContentRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {children}
    </div>
  )
}

export function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: IconComponent }) {
  return (
    <div className="flex items-center gap-3">
      {Icon && <Icon aria-hidden="true" className="size-7 shrink-0 text-muted" />}
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  )
}

export function Bars({ data, labels }: { data: number[]; labels?: string[] }) {
  const max = Math.max(1, ...data)
  return (
    <div className="flex h-32 items-stretch gap-1">
      {data.map((v, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-primary/70 hover:bg-primary"
              style={{ height: `${(v / max) * 100}%` }}
              title={`${labels?.[i] ?? i}: ${fmtNum(v)}`}
            />
          </div>
          <span className="text-[10px] text-muted/70">{labels ? labels[i] : ''}</span>
        </div>
      ))}
    </div>
  )
}

export function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-bg-3 ${className}`} />
}

export function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Sk className="size-4.5" />
          <Sk className="h-4 flex-1" />
          <Sk className="h-3 w-8" />
        </div>
      ))}
    </div>
  )
}

export function PeriodToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <ToggleGroupRoot aria-label="Stats period" className="gap-1 text-sm">
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          selected={value === o.value}
          onClick={() => onChange(o.value)}
          className="px-3 py-1 font-medium"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroupRoot>
  )
}

export function MonthNav({
  value,
  onPrev,
  onNext,
}: {
  value: string
  onPrev: () => void
  onNext: () => void
}) {
  const month = dayjs(`${value}-01`)
  return (
    <div className="inline-flex items-center gap-0.5 rounded-sm border bg-bg-2 text-sm">
      <NavButton
        icon={<ChevronLeft width={15} height={15} />}
        aria-label="Previous month"
        onClick={onPrev}
      />
      <span className="px-1 font-medium tabular-nums">
        {month.format('MMM YYYY')}
      </span>
      <NavButton
        icon={<ChevronRight width={15} height={15} />}
        aria-label="Next month"
        onClick={onNext}
      />
    </div>
  )
}

function NavButton({
  icon,
  children,
  ...props
}: ComponentProps<'button'> & { icon: ReactNode }) {
  return (
    <button
      type="button"
      className={`${buttonBase} text-muted hover:bg-bg-3 hover:text-text`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
