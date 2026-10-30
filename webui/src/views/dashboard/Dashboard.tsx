import { Favicon } from '@/components/Favicon'
import { Card, CardTitle } from '@/components/ui/card'
import { cn } from 'cn'
import dayjs from 'dayjs'
import { Fragment } from 'react'
import { dateLabel, daySpan, isoDay } from '@/lib/date'
import { ALL_TIME_DAYS, dailySeries } from '@/lib/time-series'
import { isLocalDomain } from '@/lib/domain'
import { fmtNum } from '@/lib/format'
import { useModel } from '@/lib/useModel'
import type { AppModel } from '@/app/app'
import CalendarIcon from '~icons/mdi/calendar-range'
import EyeIcon from '~icons/mdi/eye-outline'
import LinkIcon from '~icons/mdi/link-variant'
import WebIcon from '~icons/mdi/web'
import { ViewRoot } from '@/views/shared/ViewRoot'
import { RANK_MEDALS, RANK_MEDAL_COLORS } from '@/views/shared/rank-medals'
import { DashboardModel } from './dashboard.model'
import { DashboardSkeleton } from './Dashboard.components'
import { MonthNav, PeriodToggle } from '@/lib/period/Period'
import {
  Bars,
  DailyBars,
  Stat,
  StatsContentRoot,
  StatsHeaderRoot,
} from '@/views/shared/Stats'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Dashboard({ app }: { app: AppModel }) {
  const dashboard = useModel(() => new DashboardModel(app.api))
  const stats = dashboard.stats.value

  if (!stats) {
    return <DashboardSkeleton />
  }

  const { totals } = stats
  const monthly = dashboard.period.monthly.value
  const days = daySpan(totals.firstVisit, totals.lastVisit)

  const byHour = stats.byHour.map((h) => h.visits)
  const byHourLabels = stats.byHour.map((h) => `${h.hour}:00`)
  const byDow = stats.byDow.map((d) => d.visits)
  const topDomains = stats.topDomains
  const busiestDays = stats.busiestDays
  const maxDomainVisits = Math.max(1, ...topDomains.map((d) => d.visits))
  const maxBusiestVisits = Math.max(1, ...busiestDays.map((d) => d.visits))

  const dailyFrom = monthly
    ? `${dashboard.period.monthKey.value}-01`
    : totals.lastVisit === 0
      ? null
      : isoDay(Math.max(totals.firstVisit, dayjs(totals.lastVisit).subtract(ALL_TIME_DAYS - 1, 'day').valueOf()))
  const daily = dailyFrom
    ? dailySeries(
        stats.byDay ?? [],
        dailyFrom,
        monthly ? dayjs(dailyFrom).endOf('month').format('YYYY-MM-DD') : isoDay(totals.lastVisit),
        { visits: 0 },
      )
    : []
  const dailyTotal = daily.reduce((sum, d) => sum + d.visits, 0)
  const todayKey = dayjs().format('YYYY-MM-DD')
  const elapsedDays = daily.filter((d) => d.day <= todayKey).length
  const dailyAvg = elapsedDays === 0 ? 0 : dailyTotal / elapsedDays
  const activeDays = (stats.byDay ?? []).length
  const activeDenom = monthly ? elapsedDays : days

  return (
    <ViewRoot>
      <StatsHeaderRoot>
        {monthly ? <MonthNav period={dashboard.period} /> : <div />}
        <PeriodToggle period={dashboard.period} />
      </StatsHeaderRoot>

      <StatsContentRoot>
        <Card>
          <CardTitle>Overview</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="visits" value={fmtNum(totals.visits)} icon={EyeIcon} />
            <Stat label="URLs" value={fmtNum(totals.items)} icon={LinkIcon} />
            <Stat label="domains" value={fmtNum(totals.domains)} icon={WebIcon} />
            {!monthly && <Stat label="days tracked" value={fmtNum(days)} icon={CalendarIcon} />}
          </div>

          <div className="mt-4">
            <DailyBars data={daily} avg={dailyAvg} />
          </div>

          <div className="mt-3 space-y-1 border-t pt-3">
            {!monthly && totals.lastVisit !== 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Period</span>
                <span className="font-mono text-xs text-muted tabular-nums">
                  {dateLabel(totals.firstVisit)} - {dateLabel(totals.lastVisit)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">Active days</span>
              <span className="font-mono text-xs text-muted tabular-nums">
                {activeDays}/{activeDenom}
              </span>
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardTitle>By Hour of Day</CardTitle>
            <Bars data={byHour} labels={byHourLabels} />
          </Card>
          <Card>
            <CardTitle>By Day of Week</CardTitle>
            <Bars data={byDow} labels={DOW} interval={0} />
          </Card>
        </div>

        <Card>
          <CardTitle>Top Domains</CardTitle>
          <ol className="space-y-1 text-sm">
            {topDomains.map((d, i) => {
              const top = i < 3
              const Medal = RANK_MEDALS[i]
              return (
                <Fragment key={d.domain}>
                  {i === 3 && <li aria-hidden="true" className="-mx-1 h-px bg-border-2" />}
                  <li className="relative -mx-1 overflow-hidden rounded">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 rounded-r bg-primary/10"
                      style={{ width: `${(d.visits / maxDomainVisits) * 100}%` }}
                    />
                    <div className={cn('relative flex items-center gap-2 px-1', top ? 'py-1' : 'py-0.5')}>
                      <span className="flex w-5 shrink-0 items-center justify-center">
                        {top && Medal ? (
                          <Medal className={cn('size-5', RANK_MEDAL_COLORS[i])} />
                        ) : (
                          <span className="font-mono text-xs text-muted tabular-nums">{i + 1}</span>
                        )}
                      </span>
                      <Favicon host={d.domain} size={top ? 20 : 18} />
                      <span className={cn('min-w-0 flex-1 truncate', top ? 'font-medium text-text' : 'text-text-2')}>
                        {d.domain}
                      </span>
                      {isLocalDomain(d.domain) && (
                        <span className="shrink-0 rounded-full bg-primary-soft px-1.5 py-px text-[9px] font-medium tracking-wide text-primary uppercase">
                          local
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(d.visits)}</span>
                    </div>
                  </li>
                </Fragment>
              )
            })}
          </ol>
        </Card>

        {!monthly && (
          <Card>
            <CardTitle>Busiest Days</CardTitle>
            <ol className="space-y-1 text-sm">
              {busiestDays.map((d, i) => {
                const top = i < 3
                const Medal = RANK_MEDALS[i]
                return (
                  <Fragment key={d.day}>
                    {i === 3 && <li aria-hidden="true" className="-mx-1 h-px bg-border-2" />}
                    <li className="relative -mx-1 overflow-hidden rounded">
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 rounded-r bg-primary/10"
                        style={{ width: `${(d.visits / maxBusiestVisits) * 100}%` }}
                      />
                      <div className={cn('relative flex items-center gap-2 px-1', top ? 'py-1' : 'py-0.5')}>
                        <span className="flex w-5 shrink-0 items-center justify-center">
                          {top && Medal ? (
                            <Medal className={cn('size-5', RANK_MEDAL_COLORS[i])} />
                          ) : (
                            <span className="font-mono text-xs text-muted tabular-nums">{i + 1}</span>
                          )}
                        </span>
                        <span className={cn('min-w-0 flex-1 truncate', top ? 'font-medium text-text' : 'text-text-2')}>
                          {d.day} ({dayjs(d.day).format('ddd')})
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(d.visits)}</span>
                      </div>
                    </li>
                  </Fragment>
                )
              })}
            </ol>
          </Card>
        )}
      </StatsContentRoot>
    </ViewRoot>
  )
}
