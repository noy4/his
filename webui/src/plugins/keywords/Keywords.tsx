import type { ViewContext } from '../types'
import { Card, CardTitle } from '@/components/ui/card'
import dayjs from 'dayjs'
import { dateLabel, daySpan, isoDay, timeLabel } from '@/lib/date'
import { fmtNum } from '@/lib/format'
import { ALL_TIME_DAYS, dailySeries } from '@/lib/time-series'
import { MonthNav, PeriodToggle } from '@/lib/period/Period'
import { useModel } from '@/lib/useModel'
import { DailyBars, Stat, StatsContentRoot, StatsHeaderRoot } from '@/components/view/Stats'
import { ViewRoot } from '@/components/view/ViewRoot'
import { EmptyMessage, ItemsGroupRoot, ItemsGroupTitle, LoadMoreButton } from '@/components/view/RecentItems'
import { groupByDate } from '@/components/view/group-items'
import MagnifyIcon from '~icons/mdi/magnify'
import TagIcon from '~icons/mdi/tag-outline'
import EngineIcon from '~icons/mdi/search-web'
import GoogleIcon from '~icons/logos/google-icon'
import BingIcon from '~icons/logos/bing'
import DuckDuckGoIcon from '~icons/logos/duckduckgo'
import BraveIcon from '~icons/logos/brave'
import type { IconComponent } from '@/components/icons'
import type { KeywordEvent } from './keywords.data'
import { KeywordsModel } from './keywords.model'
import { KeywordsSkeleton } from './KeywordsSkeleton'

export function Keywords(_props: { app: ViewContext }) {
  const ctx = useModel(() => new KeywordsModel())
  const stats = ctx.stats.value
  if (!stats) return <KeywordsSkeleton />
  const monthly = ctx.period.monthly.value

  return (
    <ViewRoot>
      <StatsHeaderRoot>
        {monthly ? <MonthNav period={ctx.period} /> : <div />}
        <PeriodToggle period={ctx.period} />
      </StatsHeaderRoot>
      <StatsContentRoot>
        <OverviewCard ctx={ctx} />
        <DailyCard ctx={ctx} />
      </StatsContentRoot>
      <RecentCard ctx={ctx} />
    </ViewRoot>
  )
}

// --- components ---

function OverviewCard({ ctx }: { ctx: KeywordsModel }) {
  const stats = ctx.stats.value
  if (!stats) return null
  const totals = stats.totals
  const days = daySpan(totals.firstVisit, totals.lastVisit)
  return (
    <Card>
      <CardTitle>Overview</CardTitle>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="searches" value={fmtNum(totals.searches)} icon={MagnifyIcon} />
        <Stat label="keywords" value={fmtNum(totals.keywords)} icon={TagIcon} />
      </div>
      {!ctx.period.monthly.value && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted">Period</span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="font-mono tabular-nums">
              {dateLabel(totals.firstVisit)} - {dateLabel(totals.lastVisit)}
            </span>
            <span className="font-mono tabular-nums">({days}d)</span>
          </span>
        </div>
      )}
    </Card>
  )
}

function DailyCard({ ctx }: { ctx: KeywordsModel }) {
  const stats = ctx.stats.value
  if (!stats) return null
  const daily = (() => {
    if (ctx.period.monthly.value) {
      const start = `${ctx.period.monthKey.value}-01`
      return dailySeries(stats.byDay, start, dayjs(start).endOf('month').format('YYYY-MM-DD'), { visits: 0 })
    }
    const { firstVisit, lastVisit } = stats.totals
    if (lastVisit === 0) return []
    const end = dayjs(lastVisit)
    const from = Math.max(firstVisit, end.subtract(ALL_TIME_DAYS - 1, 'day').valueOf())
    return dailySeries(stats.byDay, isoDay(from), isoDay(lastVisit), { visits: 0 })
  })()
  const avg = daily.length > 0
    ? daily.reduce((sum, d) => sum + d.visits, 0) / daily.length
    : 0
  return (
    <Card>
      <CardTitle>Daily Searches</CardTitle>
      <DailyBars data={daily} avg={avg} />
    </Card>
  )
}

function RecentCard({ ctx }: { ctx: KeywordsModel }) {
  const groups = groupByDate(ctx.recent.value, (e) => e.time)
  const hasMore = ctx.nextOffset.value !== null
  return (
    <Card className="mt-4">
      <CardTitle>Recent Searches</CardTitle>
      {groups.length === 0 && <EmptyMessage text="No searches" />}
      {groups.map((group) => (
        <ItemsGroupRoot key={group.label}>
          <ItemsGroupTitle>{group.label}</ItemsGroupTitle>
          {group.items.map((event) => <RecentRow key={event.id} event={event} />)}
        </ItemsGroupRoot>
      ))}
      {hasMore && <LoadMoreButton onClick={() => ctx.loadMore()} />}
    </Card>
  )
}

function RecentRow({ event }: { event: KeywordEvent }) {
  const title = `${dateLabel(event.time)} ${timeLabel(event.time)}`
  const Icon = ENGINE_ICONS[event.engine] ?? EngineIcon
  return (
    <a
      className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-inherit no-underline hover:bg-bg-3"
      href={event.url}
      target="_blank"
      rel="noreferrer"
    >
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-bg-3">
        <Icon width={16} height={16} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{event.term}</span>
      <time
        dateTime={new Date(event.time).toISOString()}
        title={title}
        className="shrink-0 font-mono text-xs text-muted"
      >
        {timeLabel(event.time)}
      </time>
    </a>
  )
}

const ENGINE_ICONS: Partial<Record<string, IconComponent>> = {
  google: GoogleIcon,
  bing: BingIcon,
  duckduckgo: DuckDuckGoIcon,
  brave: BraveIcon,
}
