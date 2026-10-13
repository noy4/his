import { Card, CardTitle } from '@/components/ui/card'
import { cn } from 'cn'
import { dateLabel } from '@/lib/date'
import { isLocalDomain } from '@/lib/domain'
import { fmtNum } from '@/lib/format'
import { useModel } from '@/lib/useModel'
import type { AppModel } from '@/app/app'
import CalendarIcon from '~icons/mdi/calendar-range'
import EyeIcon from '~icons/mdi/eye-outline'
import LinkIcon from '~icons/mdi/link-variant'
import WebIcon from '~icons/mdi/web'
import { Favicon } from '../Favicon'
import { ViewRoot } from '../View.components'
import { DashboardModel } from './dashboard.model'
import { DashboardSkeleton } from './Dashboard.components'
import {
  Bars,
  MonthNav,
  PeriodToggle,
  Stat,
  StatsContentRoot,
  StatsHeaderRoot,
} from '../stats/Stats.components'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY = 86_400_000

export function Dashboard({ app }: { app: AppModel }) {
  const dashboard = useModel(() => new DashboardModel(app.api))
  const stats = dashboard.stats.value

  if (!stats) {
    return <DashboardSkeleton />
  }

  const { totals } = stats
  const monthly = dashboard.mode.value === 'month'
  const days = Math.round((totals.lastVisit - totals.firstVisit) / DAY) + 1

  const byHour = stats.byHour.map((h) => h.visits)
  const byHourLabels = stats.byHour.map((h) => (h.hour % 6 === 0 ? String(h.hour) : ''))
  const byDow = stats.byDow.map((d) => d.visits)
  const topDomains = stats.topDomains
  const busiestDays = stats.busiestDays

  return (
    <ViewRoot>
      <StatsHeaderRoot>
        {monthly ? (
          <MonthNav
            value={dashboard.monthKey.value}
            onPrev={() => dashboard.shiftMonth(-1)}
            onNext={() => dashboard.shiftMonth(1)}
          />
        ) : (
          <div />
        )}
        <PeriodToggle
          value={dashboard.mode.value}
          onChange={(m) => dashboard.setMode(m)}
          options={[
            { value: 'month', label: 'Monthly' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </StatsHeaderRoot>

      <StatsContentRoot>
        <Card>
          <CardTitle>Overview</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="visits" value={fmtNum(totals.visits)} icon={EyeIcon} />
            <Stat label="URLs" value={fmtNum(totals.items)} icon={LinkIcon} />
            <Stat label="domains" value={fmtNum(totals.domains)} icon={WebIcon} />
            <Stat label="days tracked" value={fmtNum(days)} icon={CalendarIcon} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-xs text-muted">Period</span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="font-mono tabular-nums">
                {dateLabel(totals.firstVisit)} - {dateLabel(totals.lastVisit)}
              </span>
              <span className="font-mono tabular-nums">({days}d)</span>
            </span>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardTitle>By Hour of Day</CardTitle>
            <Bars data={byHour} labels={byHourLabels} />
          </Card>
          <Card>
            <CardTitle>By Day of Week</CardTitle>
            <Bars data={byDow} labels={DOW} />
          </Card>
        </div>

        <Card>
          <CardTitle>Top Domains</CardTitle>
          <ol className="space-y-1 text-sm">
            {topDomains.map((d) => (
              <li
                key={d.domain}
                className={cn('-mx-1 flex items-center gap-2 rounded px-1', isLocalDomain(d.domain) && 'bg-primary-soft')}
              >
                <Favicon host={d.domain} size={18} />
                <span className="min-w-0 flex-1 truncate text-text-2">{d.domain}</span>
                <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(d.visits)}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardTitle>Busiest Days</CardTitle>
          <ol className="space-y-1 text-sm">
            {busiestDays.map((d) => (
              <li key={d.day} className="flex items-center justify-between gap-2">
                <span className="truncate text-text-2">{d.day}</span>
                <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(d.visits)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </StatsContentRoot>
    </ViewRoot>
  )
}
