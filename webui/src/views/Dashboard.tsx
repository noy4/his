import type { Stats } from '@/api'
import { dateLabel } from '@/lib/date'
import type { AppModel } from '@/models/app'
import { useEffect, useState } from 'react'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY = 86_400_000

export function Dashboard({ app }: { app: AppModel }) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let stale = false
    void app.history.stats().then((s) => {
      if (!stale) setStats(s)
    })
    return () => {
      stale = true
    }
  }, [app.history])

  if (!stats) {
    return <p className="h-full overflow-y-auto py-12 text-center font-mono text-[0.8rem] text-muted">Loading…</p>
  }

  const { totals } = stats
  const days = Math.round((totals.lastVisit - totals.firstVisit) / DAY)

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-10">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        <Card title="Overview">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="visits" value={fmtNum(totals.visits)} />
            <Stat label="URLs" value={fmtNum(totals.items)} />
            <Stat label="domains" value={fmtNum(totals.domains)} />
            <Stat label="days tracked" value={fmtNum(days)} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {dateLabel(totals.firstVisit)} → {dateLabel(totals.lastVisit)}
          </p>
        </Card>

        <div className="grid gap-4">
          <Card title="By hour of day">
            <Bars
              data={stats.byHour.map((h) => h.visits)}
              labels={stats.byHour.map((h) => (h.hour % 6 === 0 ? String(h.hour) : ''))}
            />
          </Card>
          <Card title="By day of week">
            <Bars data={stats.byDow.map((d) => d.visits)} labels={DOW} />
          </Card>
        </div>

        <Card title="Top domains">
          <ol className="space-y-1 text-sm">
            {stats.topDomains.map((d) => (
              <li key={d.domain} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-ink">{d.domain}</span>
                <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(d.visits)}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Busiest days">
          <ol className="space-y-1 text-sm">
            {stats.busiestDays.map((d) => (
              <li key={d.day} className="flex items-center justify-between gap-2">
                <span className="truncate text-ink">{d.day}</span>
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
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums text-ink-strong">{value}</div>
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

function fmtNum(n: number): string {
  return n.toLocaleString()
}
