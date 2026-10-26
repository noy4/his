import { Favicon } from '@/components/Favicon'
import { Card, CardTitle } from '@/components/ui/card'
import { cn } from 'cn'
import dayjs from 'dayjs'
import { dateLabel, daySpan, isoDay } from '@/lib/date'
import { isLocalDomain } from '@/lib/domain'
import { fmtNum } from '@/lib/format'
import { useModel } from '@/lib/useModel'
import type { AppModel } from '@/app/app'
import CalendarIcon from '~icons/mdi/calendar-range'
import ActiveIcon from '~icons/mdi/calendar-check'
import AvgIcon from '~icons/mdi/calculator-variant'
import EyeIcon from '~icons/mdi/eye-outline'
import MedalFirst from '~icons/hugeicons/medal-first-place'
import MedalSecond from '~icons/hugeicons/medal-second-place'
import MedalThird from '~icons/hugeicons/medal-third-place'
import LinkIcon from '~icons/mdi/link-variant'
import PeakIcon from '~icons/mdi/trending-up'
import WebIcon from '~icons/mdi/web'

const MEDALS = [MedalFirst, MedalSecond, MedalThird]
const MEDAL_COLORS = ['text-gold', 'text-silver', 'text-bronze']
import { ViewRoot } from '@/views/shared/ViewRoot'
import { DashboardModel } from './dashboard.model'
import { DashboardSkeleton } from './Dashboard.components'
import {
  Bars,
  DailyBars,
  MonthNav,
  PeriodToggle,
  Stat,
  StatsContentRoot,
  StatsHeaderRoot,
} from '@/views/shared/Stats'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ALL_TIME_DAYS = 90

// zero-fill the byDay series across [from, to] so the trend is continuous
function dailySeries(
  byDay: { day: string; visits: number }[],
  from: string,
  to: string,
): { day: string; visits: number }[] {
  const counts = new Map(byDay.map((d) => [d.day, d.visits]))
  const end = dayjs(to)
  const out: { day: string; visits: number }[] = []
  for (let cur = dayjs(from); !cur.isAfter(end, 'day'); cur = cur.add(1, 'day')) {
    const day = cur.format('YYYY-MM-DD')
    out.push({ day, visits: counts.get(day) ?? 0 })
  }
  return out
}

export function Dashboard({ app }: { app: AppModel }) {
  const dashboard = useModel(() => new DashboardModel(app.api))
  const stats = dashboard.stats.value

  if (!stats) {
    return <DashboardSkeleton />
  }

  const { totals } = stats
  const monthly = dashboard.mode.value === 'month'
  const days = daySpan(totals.firstVisit, totals.lastVisit)

  const byHour = stats.byHour.map((h) => h.visits)
  const byHourLabels = stats.byHour.map((h) => (h.hour % 6 === 0 ? String(h.hour) : ''))
  const byDow = stats.byDow.map((d) => d.visits)
  const topDomains = stats.topDomains
  const busiestDays = stats.busiestDays
  const maxDomainVisits = Math.max(1, ...topDomains.map((d) => d.visits))

  const daily = (() => {
    const byDay = stats.byDay ?? []
    if (monthly) {
      const start = `${dashboard.monthKey.value}-01`
      return dailySeries(byDay, start, dayjs(start).endOf('month').format('YYYY-MM-DD'))
    }
    if (totals.lastVisit === 0) return []
    const end = dayjs(totals.lastVisit)
    const from = Math.max(totals.firstVisit, end.subtract(ALL_TIME_DAYS - 1, 'day').valueOf())
    return dailySeries(byDay, isoDay(from), isoDay(totals.lastVisit))
  })()
  const dailyTotal = daily.reduce((sum, d) => sum + d.visits, 0)
  const dailyPeak = daily.reduce((max, d) => (d.visits > max.visits ? d : max), { day: '', visits: 0 })
  const dailyAvg = daily.length === 0 ? 0 : dailyTotal / daily.length
  const activeDays = daily.filter((d) => d.visits > 0).length

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

        <Card>
          <CardTitle>Daily Visits</CardTitle>
          <DailyBars data={daily} />
          <div className="mt-3 grid grid-cols-2 gap-4 border-t pt-3">
            <Stat
              icon={PeakIcon}
              label={dailyPeak.day ? `max · ${dayjs(dailyPeak.day).format('M/D')}` : 'max'}
              value={fmtNum(dailyPeak.visits)}
            />
            <Stat icon={AvgIcon} label="avg / day" value={fmtNum(Math.round(dailyAvg))} />
            <Stat icon={ActiveIcon} label="active days" value={`${activeDays}/${daily.length}`} />
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
            {topDomains.map((d, i) => {
              const top = i < 3
              const Medal = MEDALS[i]
              return (
                <li
                  key={d.domain}
                  className={cn('relative -mx-1 overflow-hidden rounded', i === 3 && 'mt-1 border-t border-border-2')}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-primary/10"
                    style={{ width: `${(d.visits / maxDomainVisits) * 100}%` }}
                  />
                  <div className={cn('relative flex items-center gap-2 px-1', top ? 'py-1' : 'py-0.5')}>
                    <span className="flex w-5 shrink-0 items-center justify-center">
                      {top && Medal ? (
                        <Medal className={cn('size-5', MEDAL_COLORS[i])} />
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
              )
            })}
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
