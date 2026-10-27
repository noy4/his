import type { YoutubeStats } from '@/app/api'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Bar, BarChart, LabelList, ReferenceArea, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { fmtNum } from '@/lib/format'

type YoutubeDailyRow = YoutubeStats['byDay'][number]
export type YoutubeDayKey = keyof Omit<YoutubeDailyRow, 'day'>

const BREAKDOWN: { key: Exclude<YoutubeDayKey, 'all'>; label: string }[] = [
  { key: 'video', label: 'Videos' },
  { key: 'shorts', label: 'Shorts' },
  { key: 'other', label: 'Other' },
]

// YouTube-only daily visits chart: one bar per day, peak labelled.
export function YoutubeDailyVisitsChart({ data, dataKey }: { data: YoutubeDailyRow[]; dataKey: YoutubeDayKey }) {
  const today = dayjs().format('YYYY-MM-DD')
  const [width, setWidth] = useState(0)
  const peakValue = data.reduce((max, d) => Math.max(max, Number(d[dataKey])), 0)
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
        <Tooltip cursor={{ fill: 'var(--color-primary-soft)' }} content={<YoutubeDailyTooltip dataKey={dataKey} />} />
        {data.some((d) => d.day === today) && (
          <ReferenceArea x1={today} x2={today} fill="var(--color-warn-soft)" strokeOpacity={0} />
        )}
        <Bar dataKey={dataKey} fill="var(--color-primary)" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          <LabelList
            dataKey={dataKey}
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

// --- tooltip ---

function YoutubeDailyTooltip({
  active,
  payload,
  dataKey,
}: {
  active?: boolean
  payload?: readonly { payload?: YoutubeDailyRow }[]
  dataKey: YoutubeDayKey
}) {
  const row = payload?.[0]?.payload
  if (active !== true || row === undefined) return null
  return (
    <div className="min-w-[200px] max-w-[280px] rounded-md border border-border-2 bg-bg-2 px-2.5 py-2 text-xs shadow-lg">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-muted">{dayjs(row.day).format('ddd, M/D')}</span>
        <span className="font-mono tabular-nums">{fmtNum(row[dataKey])}</span>
      </div>
      {dataKey === 'all' && (
        <div className="space-y-0.5">
          {BREAKDOWN.filter(({ key }) => row[key] > 0).map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-text-2">{label}</span>
              <span className="font-mono text-muted tabular-nums">{fmtNum(row[key])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
