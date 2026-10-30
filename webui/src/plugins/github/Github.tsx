import { Card, CardTitle } from '@/components/ui/card'
import { dateLabel, daySpan } from '@/lib/date'
import { fmtNum } from '@/lib/format'
import { VisitCount } from '@/components/view/RecentItems'
import { useModel } from '@/lib/useModel'
import type { ViewContext } from '../types'
import { cn } from 'cn'
import AccountIcon from '~icons/mdi/account-group-outline'
import EyeIcon from '~icons/mdi/eye-outline'
import PullIcon from '~icons/octicon/git-pull-request-16'
import RepoIcon from '~icons/octicon/repo-16'
import { MonthNav, PeriodToggle } from '@/lib/period/Period'
import {
  Stat,
  StatsContentRoot,
  StatsHeaderRoot,
} from '@/components/view/Stats'
import { RANK_MEDALS, RANK_MEDAL_COLORS } from '@/components/view/rank-medals'
import { ViewRoot } from '@/components/view/ViewRoot'
import { GithubAvatar, GithubKindAvatar } from './Github.components'
import { GithubDailyVisitsCard } from './GithubDailyVisitsCard'
import { GithubRecentItemsCard } from './GithubRecentItemsCard'
import { GithubModel } from './github.model'
import { GithubSkeleton } from './GithubSkeleton'

const rowCls = '-mx-1 flex items-center gap-2 rounded px-1 hover:bg-bg-3'

export function Github({ app }: { app: ViewContext }) {
  const gh = useModel(() => new GithubModel(app.rpc))
  const stats = gh.stats.value
  if (!stats) return <GithubSkeleton />

  const monthly = gh.period.monthly.value

  return (
    <ViewRoot>
      <StatsHeaderRoot>
        {monthly ? <MonthNav period={gh.period} /> : <div />}
        <PeriodToggle period={gh.period} />
      </StatsHeaderRoot>

      <StatsContentRoot>
        <OverviewCard gh={gh} />
        <GithubDailyVisitsCard gh={gh} />
        <TopReposCard gh={gh} />
        {!monthly && <TopOwnersCard gh={gh} />}
        <TopItemsCard gh={gh} />
      </StatsContentRoot>
      <GithubRecentItemsCard gh={gh} />
    </ViewRoot>
  )
}

// --- components ---

function OverviewCard({ gh }: { gh: GithubModel }) {
  const stats = gh.stats.value
  if (!stats) return null
  const totals = stats.totals
  const days = daySpan(totals.firstVisit, totals.lastVisit)
  const monthly = gh.period.monthly.value
  return (
    <Card>
      <CardTitle>Overview</CardTitle>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="visits" value={fmtNum(totals.visits)} icon={EyeIcon} />
        <Stat label="repos" value={fmtNum(totals.repos)} icon={RepoIcon} />
        <Stat label="owners" value={fmtNum(totals.owners)} icon={AccountIcon} />
        <Stat label="Issues / PRs" value={fmtNum(totals.items)} icon={PullIcon} />
      </div>
      {!monthly && (
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

function TopReposCard({ gh }: { gh: GithubModel }) {
  const stats = gh.stats.value
  if (!stats) return null
  const maxVisits = Math.max(1, ...stats.topRepos.map((r) => r.visits))
  return (
    <Card>
      <CardTitle>Top Repos</CardTitle>
      <ol className="space-y-1 text-sm">
        {stats.topRepos.map((r, i) => {
          const top = i < 3
          const Medal = RANK_MEDALS[i]
          return (
            <li key={`${r.owner}/${r.repo}`} className="relative -mx-1 overflow-hidden rounded">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-r bg-primary/10"
                style={{ width: `${(r.visits / maxVisits) * 100}%` }}
              />
              <button
                type="button"
                className="relative flex w-full items-center gap-2 rounded px-1 text-left hover:bg-bg-3"
                onClick={() => gh.setFilter({
                  owner: r.owner,
                  repo: r.repo
                })}
              >
                <span className="flex w-5 shrink-0 items-center justify-center">
                  {top && Medal ? (
                    <Medal className={cn('size-5', RANK_MEDAL_COLORS[i])} />
                  ) : (
                    <span className="font-mono text-xs text-muted tabular-nums">{i + 1}</span>
                  )}
                </span>
                <GithubAvatar owner={r.owner} />
                <div className="min-w-0 flex-1 truncate text-text-2">
                  <span className="text-muted">{r.owner}/</span>{r.repo}
                </div>
                <VisitCount n={r.visits} />
              </button>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function TopOwnersCard({ gh }: { gh: GithubModel }) {
  const stats = gh.stats.value
  if (!stats) return null
  const maxVisits = Math.max(1, ...stats.topOwners.map((o) => o.visits))
  return (
    <Card>
      <CardTitle>Top Owners</CardTitle>
      <ol className="space-y-1 text-sm">
        {stats.topOwners.map((o, i) => {
          const top = i < 3
          const Medal = RANK_MEDALS[i]
          return (
            <li key={o.owner} className="relative -mx-1 overflow-hidden rounded">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-r bg-primary/10"
                style={{ width: `${(o.visits / maxVisits) * 100}%` }}
              />
              <button
                type="button"
                className="relative flex w-full items-center gap-2 rounded px-1 text-left hover:bg-bg-3"
                onClick={() => gh.setFilter({ owner: o.owner })}
              >
                <span className="flex w-5 shrink-0 items-center justify-center">
                  {top && Medal ? (
                    <Medal className={cn('size-5', RANK_MEDAL_COLORS[i])} />
                  ) : (
                    <span className="font-mono text-xs text-muted tabular-nums">{i + 1}</span>
                  )}
                </span>
                <GithubAvatar owner={o.owner} />
                <span className="min-w-0 flex-1 truncate text-text-2">
                  {o.owner}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {o.repos} repos
                </span>
                <VisitCount n={o.visits} />
              </button>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function TopItemsCard({ gh }: { gh: GithubModel }) {
  const stats = gh.stats.value
  if (!stats) return null
  return (
    <Card>
      <CardTitle>Top Issues / PRs</CardTitle>
      <ol className="space-y-1.5 text-sm">
        {stats.topItems.map((it) => {
          return (
            <li key={it.url}>
              <a
                className={cn(rowCls, 'items-start')}
                href={it.url}
                target="_blank"
                rel="noreferrer"
              >
                <GithubKindAvatar
                  owner={it.owner}
                  kind={it.kind}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-text-2">{it.title}</div>
                  <div className="truncate text-xs text-muted">
                    {it.owner}/{it.repo}#{it.number}
                  </div>
                </div>
                <VisitCount n={it.visits} />
              </a>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
