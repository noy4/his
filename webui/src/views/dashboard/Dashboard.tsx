import { dateLabel } from '@/lib/date'
import { isLocalDomain } from '@/lib/domain'
import { fmtNum } from '@/lib/format'
import { useModel } from '@/lib/useModel'
import type { AppModel } from '@/models/app'
import dayjs from 'dayjs'
import { Favicon } from '../Favicon'
import { DashboardModel } from './dashboard.model'
import {
  Bars,
  Card,
  DashboardContentRoot,
  DashboardHeaderRoot,
  DashboardRoot,
  MonthNav,
  SegmentedControl,
  Stat,
} from './Dashboard.components'

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

  const byHour = stats.byHour.map((h) => h.visits)
  const byHourLabels = stats.byHour.map((h) => (h.hour % 6 === 0 ? String(h.hour) : ''))
  const byDow = stats.byDow.map((d) => d.visits)
  const topDomains = stats.topDomains
  const busiestDays = stats.busiestDays

  return (
    <DashboardRoot>
      <DashboardHeaderRoot>
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
      </DashboardHeaderRoot>

      <DashboardContentRoot>
        <Card title="Overview">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="visits" value={fmtNum(totals.visits)} />
            <Stat label="URLs" value={fmtNum(totals.items)} />
            <Stat label="domains" value={fmtNum(totals.domains)} />
            <Stat label="days tracked" value={fmtNum(days)} />
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
              <li
                key={d.domain}
                className={`-mx-1 flex items-center gap-2 rounded px-1 ${isLocalDomain(d.domain) ? 'bg-primary-soft' : ''}`}
              >
                <Favicon host={d.domain} size={18} />
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
      </DashboardContentRoot>
    </DashboardRoot>
  )
}
