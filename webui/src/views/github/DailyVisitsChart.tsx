import type { GithubDayItem, GithubDayKind, GithubVisitKind } from '@/app/api'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Bar, BarChart, LabelList, ReferenceArea, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { fmtNum } from '@/lib/format'
import WebIcon from '~icons/mdi/web'
import { GitHubAvatar, GitHubKindAvatar } from './GitHub.components'

export interface DailyVisitTop {
  repo: GithubDayItem[]
  issue_pr: GithubDayItem[]
  other: GithubDayItem[]
}

export interface DailyVisitRow {
  day: string
  all: number
  repo: number
  issue_pr: number
  other: number
  top: DailyVisitTop
}

// GitHub-only daily visits chart: one bar per day.
// Tooltip breaks the hovered day down: kind totals for 'all', most recently visited items otherwise.
export function DailyVisitsChart({ data, dataKey }: { data: DailyVisitRow[]; dataKey: GithubVisitKind }) {
  const today = dayjs().format('YYYY-MM-DD')
  const [width, setWidth] = useState(0)
  let peakDay = ''
  let peakMax = -1
  for (const d of data) {
    if (d[dataKey] > peakMax) {
      peakMax = d[dataKey]
      peakDay = d.day
    }
  }
  if (peakMax <= 0) peakDay = ''
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
        <Tooltip cursor={{ fill: 'var(--color-primary-soft)' }} content={<DailyVisitsTooltip dataKey={dataKey} />} />
        {data.some((d) => d.day === today) && (
          <ReferenceArea x1={today} x2={today} fill="var(--color-warn-soft)" strokeOpacity={0} />
        )}
        <Bar dataKey={dataKey} fill="var(--color-primary)" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          <LabelList
            dataKey={dataKey}
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

// --- tooltip ---

const KIND_ROWS: { key: GithubDayKind; label: string }[] = [
  { key: 'repo', label: 'Repos' },
  { key: 'issue_pr', label: 'Issues/PRs' },
  { key: 'other', label: 'Other' },
]

function DailyVisitsTooltip({
  active,
  payload,
  dataKey,
}: {
  active?: boolean
  payload?: readonly { payload?: DailyVisitRow }[]
  dataKey: GithubVisitKind
}) {
  const row = payload?.[0]?.payload
  if (active !== true || row === undefined) return null
  const total = row[dataKey]
  return (
    <div className="min-w-[200px] max-w-[280px] rounded-md border border-border-2 bg-bg-2 px-2.5 py-2 text-xs shadow-lg">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-muted">{dayjs(row.day).format('ddd, M/D')}</span>
        <span className="font-mono tabular-nums">{fmtNum(total)}</span>
      </div>
      {dataKey === 'all' ? <KindBreakdown row={row} /> : <DayItems items={row.top[dataKey]} total={total} />}
    </div>
  )
}

function KindBreakdown({ row }: { row: DailyVisitRow }) {
  const rows = KIND_ROWS.filter(({ key }) => row[key] > 0)
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

function DayItems({ items, total }: { items: GithubDayItem[]; total: number }) {
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

function DayItemRow({ item }: { item: GithubDayItem }) {
  const label = item.kind === 'issue_pr'
    ? `${item.owner}/${item.repo}#${item.number}`
    : item.repo === undefined ? item.owner : `${item.owner}/${item.repo}`
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 shrink-0 font-mono text-muted tabular-nums">{dayjs(item.lastVisit).format('HH:mm')}</span>
      {item.kind === 'repo' && <GitHubAvatar owner={item.owner} size={14} />}
      {item.kind === 'issue_pr' && <GitHubKindAvatar owner={item.owner} kind={item.pullKind ?? 'pull'} size={14} />}
      {item.kind === 'other' && <WebIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted" />}
      <span className="min-w-0 flex-1 truncate text-text-2">{label}</span>
      <span className="shrink-0 font-mono text-muted tabular-nums">{fmtNum(item.visits)}</span>
    </div>
  )
}
