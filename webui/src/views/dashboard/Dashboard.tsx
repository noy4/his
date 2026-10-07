import { dateLabel } from '@/lib/date'
import { useModel } from '@/lib/useModel'
import type { AppModel } from '@/models/app'
import dayjs from 'dayjs'
import ChevronLeft from '~icons/mdi/chevron-left'
import ChevronRight from '~icons/mdi/chevron-right'
import { DashboardModel } from './dashboard.model'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY = 86_400_000

export function Dashboard({ app }: { app: AppModel }) {
  const dashboard = useModel(() => new DashboardModel(app.api))
  const stats = dashboard.stats.value

  if (!stats) {
    return <p className="h-full overflow-y-auto py-12 text-center font-mono text-[0.8rem] text-muted">Loading…</p>
  }

  const { totals } = stats
  const monthly = dashboard.mode.value === 'month'
  const month = dayjs(`${dashboard.monthKey.value}-01`)
  const days = Math.round((totals.lastVisit - totals.firstVisit) / DAY)

  const byHour = monthly ? [] : stats.byHour.map((h) => h.visits)
  const byHourLabels = monthly ? [] : stats.byHour.map((h) => (h.hour % 6 === 0 ? String(h.hour) : ''))
  const byDow = monthly ? [] : stats.byDow.map((d) => d.visits)
  const topDomains = monthly ? [] : stats.topDomains
  const busiestDays = monthly ? [] : stats.busiestDays

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        {monthly ? (
          <MonthNav
            value={dashboard.monthKey.value}
            onPrev={() => dashboard.shiftMonth(-1)}
            onNext={() => dashboard.shiftMonth(1)}
          />
        ) : (
          <div />
        )}
        <SegmentedControl
          value={dashboard.mode.value}
          onChange={(m) => dashboard.setMode(m)}
          options={[
            { value: 'month', label: 'Monthly' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        <Card title="Overview">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="visits" value={monthly ? '—' : fmtNum(totals.visits)} />
            <Stat label="URLs" value={monthly ? '—' : fmtNum(totals.items)} />
            <Stat label="domains" value={monthly ? '—' : fmtNum(totals.domains)} />
            <Stat label="days tracked" value={monthly ? '—' : fmtNum(days)} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {monthly ? month.format('MMM YYYY') : `${dateLabel(totals.firstVisit)} → ${dateLabel(totals.lastVisit)}`}
          </p>
        </Card>

        <div className="grid gap-4">
          <Card title="By hour of day">
            <Bars data={byHour} labels={byHourLabels} />
          </Card>
          <Card title="By day of week">
            <Bars data={byDow} labels={DOW} />
          </Card>
        </div>

        <Card title="Top domains">
          <ol className="space-y-1 text-sm">
            {topDomains.map((d) => (
              <li key={d.domain} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-text-2">{d.domain}</span>
                <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(d.visits)}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Busiest days">
          <ol className="space-y-1 text-sm">
            {busiestDays.map((d) => (
              <li key={d.day} className="flex items-center justify-between gap-2">
                <span className="truncate text-text-2">{d.day}</span>
                <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(d.visits)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}

// --- components ---

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-bg-2 p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function Bars({ data, labels }: { data: number[]; labels?: string[] }) {
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

function SegmentedControl<T extends string>({
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

function MonthNav({
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
      <button
        type="button"
        aria-label="Previous month"
        onClick={onPrev}
        className="inline-flex items-center px-1.5 py-1 text-muted transition-colors hover:text-text"
      >
        <ChevronLeft width={15} height={15} />
      </button>
      <span className="px-1 font-medium tabular-nums">{month.format('MMM YYYY')}</span>
      <button
        type="button"
        aria-label="Next month"
        onClick={onNext}
        className="inline-flex items-center px-1.5 py-1 text-muted transition-colors hover:text-text"
      >
        <ChevronRight width={15} height={15} />
      </button>
    </div>
  )
}

function fmtNum(n: number): string {
  return n.toLocaleString()
}
