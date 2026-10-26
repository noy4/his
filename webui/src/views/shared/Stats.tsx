import dayjs from 'dayjs'
import { useState } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import ChevronLeft from '~icons/mdi/chevron-left'
import ChevronRight from '~icons/mdi/chevron-right'
import type { ComponentProps, ReactNode } from 'react'
import type { IconComponent } from '@/components/icons'
import { buttonSmGhost } from '@/components/ui/button'
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

const TOOLTIP_CONTENT_STYLE = {
  background: 'var(--color-bg-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
} as const

export function Bars({
  data,
  labels,
  interval = 'preserveStartEnd',
}: {
  data: number[]
  labels?: string[]
  interval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd'
}) {
  const chartData = data.map((v, i) => ({ label: labels?.[i] ?? String(i), value: v }))
  return (
    <ResponsiveContainer width="100%" height={128}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap={1}>
        <XAxis
          dataKey="label"
          interval={interval}
          minTickGap={24}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-primary-soft)' }}
          formatter={(v) => [fmtNum(Number(v)), 'visits']}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          labelStyle={{ color: 'var(--color-muted)' }}
          itemStyle={{ color: 'var(--color-text)' }}
        />
        <Bar dataKey="value" fill="var(--color-primary)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// daily trend — Recharts bar chart, one bar per day, value labelled on the peak
export function DailyBars({ data }: { data: { day: string; visits: number }[] }) {
  const peakDay = data.reduce((max, d) => (d.visits > max.visits ? d : max), { day: '', visits: 0 }).day
  const [width, setWidth] = useState(0)
  return (
    <ResponsiveContainer width="100%" height={160} onResize={(w) => setWidth(w)}>
      <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: 4 }} barCategoryGap={1}>
        <XAxis
          dataKey="day"
          tickFormatter={(v: string) => dayjs(v).format('M/D')}
          interval="preserveStartEnd"
          minTickGap={24}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-primary-soft)' }}
          labelFormatter={(v) => dayjs(String(v)).format('ddd, M/D')}
          formatter={(v) => [fmtNum(Number(v)), 'visits']}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          labelStyle={{ color: 'var(--color-muted)' }}
          itemStyle={{ color: 'var(--color-text)' }}
        />
        <Bar dataKey="visits" fill="var(--color-primary)" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="visits"
            content={(props) => {
              if (props.index === undefined || data[props.index]?.day !== peakDay) return <g />
              const text = fmtNum(Number(props.value))
              const center = Number(props.x) + Number(props.width) / 2
              const half = (text.length * 5.5) / 2
              const y = Number(props.y) - 4
              const nearLeft = width > 0 && center - half < 2
              const nearRight = width > 0 && center + half > width - 2
              return (
                <text
                  x={nearLeft ? 2 : nearRight ? width - 2 : center}
                  y={y}
                  textAnchor={nearLeft ? 'start' : nearRight ? 'end' : 'middle'}
                  fontSize={10}
                  fill="var(--color-muted)"
                >
                  {text}
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
      className={buttonSmGhost}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
