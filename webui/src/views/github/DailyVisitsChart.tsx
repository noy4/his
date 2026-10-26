import dayjs from 'dayjs'
import { Bar, BarChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { fmtNum } from '@/lib/format'
import { TOOLTIP_CONTENT_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from '@/views/shared/chart-style'

export interface DailyVisitRow {
  day: string
  all: number
  repo: number
  issue_pr: number
  other: number
}

// GitHub-only daily visits chart: one bar per day for the selected kind, count-only tooltip.
export function DailyVisitsChart({ data, dataKey }: { data: DailyVisitRow[]; dataKey: keyof DailyVisitRow }) {
  const today = dayjs().format('YYYY-MM-DD')
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={1}>
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
        <Bar dataKey={dataKey} fill="var(--color-primary)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
