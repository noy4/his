import type { YoutubeDayItem, YoutubeStats, YoutubeUrlInfo } from '@his/core'
import { parseYoutubeTitle } from '@his/core'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Bar, BarChart, LabelList, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { fmtNum } from '@/lib/format'
import { YoutubeItemAvatar } from './Youtube.components'

type YoutubeDailyRow = YoutubeStats['byDay'][number]
export type YoutubeDayKey = keyof Omit<YoutubeDailyRow, 'day'>

export interface YoutubeDailyVisitTop {
  video: YoutubeDayItem[]
  shorts: YoutubeDayItem[]
  other: YoutubeDayItem[]
}

export type YoutubeDailyVisitRow = YoutubeDailyRow & {
  top: YoutubeDailyVisitTop
}

const BREAKDOWN: { key: Exclude<YoutubeDayKey, 'all'>; label: string }[] = [
  { key: 'video', label: 'Videos' },
  { key: 'shorts', label: 'Shorts' },
  { key: 'other', label: 'Other' },
]

// YouTube-only daily visits chart: one bar per day, peak labelled, dashed average line.
// Tooltip breaks the hovered day down: kind totals for 'all', top items (with thumbnails) otherwise.
export function YoutubeDailyVisitsChart({ data, dataKey }: { data: YoutubeDailyVisitRow[]; dataKey: YoutubeDayKey }) {
  const today = dayjs().format('YYYY-MM-DD')
  const [width, setWidth] = useState(0)
  const peakValue = data.reduce((max, d) => Math.max(max, Number(d[dataKey])), 0)
  const elapsed = data.filter((d) => d.day <= today)
  const avg = elapsed.length === 0
    ? 0
    : elapsed.reduce((sum, d) => sum + Number(d[dataKey]), 0) / elapsed.length
  return (
    <ResponsiveContainer width="100%" height={160} onResize={(w) => setWidth(w)}>
      <BarChart
        data={data}
        margin={{ top: 16, right: 4, bottom: 0, left: 4 }}
        barCategoryGap={1}
      >
        <XAxis
          dataKey="day"
          tickFormatter={(v: string) => dayjs(v).format('M/D')}
          interval="preserveStartEnd"
          minTickGap={44}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
        />
        <Tooltip cursor={{ fill: 'var(--color-primary-soft)' }} content={<YoutubeDailyTooltip dataKey={dataKey} />} />
        {data.some((d) => d.day === today) && (
          <ReferenceArea x1={today} x2={today} fill="var(--color-warn-soft)" strokeOpacity={0} />
        )}
        {avg > 0 && (
          <ReferenceLine
            y={avg}
            stroke="var(--color-muted)"
            strokeDasharray="3 3"
            label={{ value: fmtNum(Math.round(avg)), position: 'insideBottomRight', fill: 'var(--color-muted)', fontSize: 10, fontStyle: 'italic' }}
          />
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
  payload?: readonly { payload?: YoutubeDailyVisitRow }[]
  dataKey: YoutubeDayKey
}) {
  const row = payload?.[0]?.payload
  if (active !== true || row === undefined) return null
  const total = row[dataKey]
  return (
    <div className="min-w-50 max-w-70 rounded-md border border-border-2 bg-bg-2 px-2.5 py-2 text-xs shadow-lg">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-muted">{dayjs(row.day).format('ddd, M/D')}</span>
        <span className="font-mono tabular-nums">{fmtNum(total)}</span>
      </div>
      {dataKey === 'all' ? <KindBreakdown row={row} /> : <DayItems items={row.top[dataKey]} total={total} />}
    </div>
  )
}

function KindBreakdown({ row }: { row: YoutubeDailyVisitRow }) {
  const rows = BREAKDOWN.filter(({ key }) => row[key] > 0)
  if (rows.length === 0) return null
  return (
    <div className="space-y-0.5">
      {rows.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="text-text-2">{label}</span>
          <span className="font-mono text-muted tabular-nums">{fmtNum(row[key])}</span>
        </div>
      ))}
    </div>
  )
}

function DayItems({ items, total }: { items: YoutubeDayItem[]; total: number }) {
  if (items.length === 0) return null
  const remaining = total - items.reduce((sum, item) => sum + item.visits, 0)
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <DayItemRow key={item.key} item={item} />
      ))}
      {remaining > 0 && (
        <div className="pt-0.5 text-right font-mono text-muted tabular-nums">+{fmtNum(remaining)} more</div>
      )}
    </div>
  )
}

function DayItemRow({ item }: { item: YoutubeDayItem }) {
  const info = infoOf(item)
  const name = parseYoutubeTitle(item.title || item.url, info).name
  return (
    <div className="flex items-center gap-1.5">
      <YoutubeItemAvatar info={info} size={18} />
      <span className="min-w-0 flex-1 truncate text-text-2">{name}</span>
      <span className="shrink-0 font-mono text-muted tabular-nums">{fmtNum(item.visits)}</span>
    </div>
  )
}

// day item → the info the thumbnail/avatar component understands (shorts drop their badge here)
function infoOf(item: YoutubeDayItem): YoutubeUrlInfo {
  if (item.kind === 'video' || item.kind === 'shorts') return { kind: 'video', id: item.id }
  if (item.kind === 'channel') return { kind: 'channel', id: item.id }
  if (item.kind === 'playlist') return { kind: 'playlist', id: item.id }
  return {}
}
