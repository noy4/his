import dayjs from 'dayjs'
import type { ComponentProps, ReactNode } from 'react'
import ChevronLeft from '~icons/mdi/chevron-left'
import ChevronRight from '~icons/mdi/chevron-right'
import { buttonSmGhost } from '@/components/ui/button'
import { ToggleGroupItem, ToggleGroupRoot } from '@/components/ui/toggle-group'
import type { PeriodModel, PeriodMode } from './period.model'

const PERIOD_OPTIONS: { value: PeriodMode; label: string }[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'all', label: 'All time' },
]

export function PeriodToggle({ period }: { period: PeriodModel }) {
  return (
    <ToggleGroupRoot aria-label="Stats period" className="gap-1 text-sm">
      {PERIOD_OPTIONS.map((o) => (
        <ToggleGroupItem
          key={o.value}
          selected={period.mode.value === o.value}
          onClick={() => period.setMode(o.value)}
          className="px-3 py-1 font-medium"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroupRoot>
  )
}

export function MonthNav({ period }: { period: PeriodModel }) {
  const month = dayjs(`${period.monthKey.value}-01`)
  return (
    <div className="inline-flex items-center gap-0.5 rounded-sm border bg-bg-2 text-sm">
      <NavButton
        icon={<ChevronLeft width={15} height={15} />}
        aria-label="Previous month"
        onClick={() => period.shiftMonth(-1)}
      />
      <span className="px-1 font-medium tabular-nums">
        {month.format('MMM YYYY')}
      </span>
      <NavButton
        icon={<ChevronRight width={15} height={15} />}
        aria-label="Next month"
        onClick={() => period.shiftMonth(1)}
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
      className={buttonSmGhost}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
