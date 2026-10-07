import dayjs from 'dayjs'
import ChevronLeft from '~icons/mdi/chevron-left'
import ChevronRight from '~icons/mdi/chevron-right'
import type { ComponentProps, ReactNode } from 'react'
import { buttonBase } from '@/components/ui/button'
import { fmtNum } from '@/lib/format'

export function DashboardRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-10">
      {children}
    </div>
  )
}

export function DashboardHeaderRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      {children}
    </div>
  )
}

export function DashboardContentRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {children}
    </div>
  )
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-bg-2 p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
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

function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-bg-3 ${className}`} />
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Sk className="size-[18px]" />
          <Sk className="h-4 flex-1" />
          <Sk className="h-3 w-8" />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <DashboardRoot>
      <DashboardHeaderRoot>
        <Sk className="h-8 w-36" />
        <Sk className="h-8 w-44" />
      </DashboardHeaderRoot>
      <DashboardContentRoot>
        <Card title="Overview">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Sk className="h-7 w-20" />
                <Sk className="h-3 w-12" />
              </div>
            ))}
          </div>
          <Sk className="mt-3 h-3 w-32" />
        </Card>
        <div className="grid gap-4">
          <Card title="By hour of day"><Sk className="h-32" /></Card>
          <Card title="By day of week"><Sk className="h-32" /></Card>
        </div>
        <Card title="Top domains"><ListSkeleton /></Card>
        <Card title="Busiest days"><ListSkeleton /></Card>
      </DashboardContentRoot>
    </DashboardRoot>
  )
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex shrink-0 gap-1 rounded-sm bg-bg-3 p-0.5 text-sm" role="group" aria-label="Stats period">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-3 py-1 font-medium transition-colors ${value === o.value ? 'bg-bg-2 text-text' : 'text-muted hover:text-text'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
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
