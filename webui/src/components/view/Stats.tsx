import dayjs from 'dayjs'
import { useState } from 'react'
import { Bar, BarChart, LabelList, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { IconComponent } from '@/components/icons'
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

import { TOOLTIP_CONTENT_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from '@/components/view/chart-style'

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
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        <Bar dataKey="value" fill="var(--color-primary)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// daily trend — Recharts bar chart, value labelled on the peak, optional dashed average line
export function DailyBars({ data, avg }: { data: { day: string; visits: number }[]; avg?: number }) {
  const peakValue = data.reduce((max, d) => Math.max(max, d.visits), 0)
  const today = dayjs().format('YYYY-MM-DD')
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
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        {data.some((d) => d.day === today) && (
          <ReferenceArea x1={today} x2={today} fill="var(--color-warn-soft)" strokeOpacity={0} />
        )}
        {avg !== undefined && avg > 0 && (
          <ReferenceLine
            y={avg}
            stroke="var(--color-muted)"
            strokeDasharray="3 3"
            label={{ value: fmtNum(Math.round(avg)), position: 'insideBottomRight', fill: 'var(--color-muted)', fontSize: 10, fontStyle: 'italic' }}
          />
        )}
        <Bar dataKey="visits" fill="var(--color-primary)" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="visits"
            content={(props) => {
              if (peakValue <= 0 || Number(props.value) !== peakValue) return <g />
              const text = fmtNum(peakValue)
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
