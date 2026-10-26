import { Card, CardTitle } from '@/components/ui/card'
import { dateLabel } from '@/lib/date'
import { fmtNum } from '@/lib/format'
import { VisitCount } from './GitHub.components'
import { useModel } from '@/lib/useModel'
import type { AppModel } from '@/app/app'
import { cn } from 'cn'
import AccountIcon from '~icons/mdi/account-group-outline'
import EyeIcon from '~icons/mdi/eye-outline'
import PullIcon from '~icons/octicon/git-pull-request-16'
import RepoIcon from '~icons/octicon/repo-16'
import {
  MonthNav,
  PeriodToggle,
  Stat,
  StatsContentRoot,
  StatsHeaderRoot,
} from '@/views/shared/Stats'
import { ViewRoot } from '@/views/shared/ViewRoot'
import { GitHubAvatar, GitHubKindAvatar } from './GitHub.components'
import { RecentVisitsCard } from './RecentVisitsCard'
import { GithubModel } from './github.model'
import { GitHubSkeleton } from './GitHub.skeleton'

const rowCls = '-mx-1 flex items-center gap-2 rounded px-1 hover:bg-bg-3'
const DAY = 86_400_000

export function GitHub({ app }: { app: AppModel }) {
  const gh = useModel(() => new GithubModel(app.api))
  const stats = gh.stats.value
  if (!stats) return <GitHubSkeleton />

  const monthly = gh.mode.value === 'month'

  return (
    <ViewRoot>
      <StatsHeaderRoot>
        {monthly ? (
          <MonthNav
            value={gh.monthKey.value}
            onPrev={() => gh.shiftMonth(-1)}
            onNext={() => gh.shiftMonth(1)}
          />
        ) : (
          <div />
        )}
        <PeriodToggle
          value={gh.mode.value}
          onChange={(m) => gh.setMode(m)}
          options={[
            { value: 'month', label: 'Monthly' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </StatsHeaderRoot>

      <StatsContentRoot>
        <OverviewCard gh={gh} />
        <TopReposCard gh={gh} />
        <TopOwnersCard gh={gh} />
        <TopItemsCard gh={gh} />
      </StatsContentRoot>
      <RecentVisitsCard gh={gh} />
    </ViewRoot>
  )
}

// --- components ---

function OverviewCard({ gh }: { gh: GithubModel }) {
  const stats = gh.stats.value
  if (!stats) return null
  const totals = stats.totals
  const days = Math.round((totals.lastVisit - totals.firstVisit) / DAY) + 1
  return (
    <Card>
      <CardTitle>Overview</CardTitle>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="visits" value={fmtNum(totals.visits)} icon={EyeIcon} />
        <Stat label="repos" value={fmtNum(totals.repos)} icon={RepoIcon} />
        <Stat label="owners" value={fmtNum(totals.owners)} icon={AccountIcon} />
        <Stat label="Issues / PRs" value={fmtNum(totals.items)} icon={PullIcon} />
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
  )
}

function TopReposCard({ gh }: { gh: GithubModel }) {
  const stats = gh.stats.value
  if (!stats) return null
  return (
    <Card>
      <CardTitle>Top Repos</CardTitle>
      <ol className="space-y-1 text-sm">
        {stats.topRepos.map((r) => (
          <li key={`${r.owner}/${r.repo}`}>
            <button
              type="button"
              className={cn(rowCls, 'w-full text-left')}
              onClick={() => gh.setFilter({
                owner: r.owner,
                repo: r.repo
              })}
            >
              <GitHubAvatar owner={r.owner} />
              <div className="min-w-0 flex-1 truncate text-text-2">
                <span className="text-muted">{r.owner}/</span>{r.repo}
              </div>
              <VisitCount n={r.visits} />
            </button>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function TopOwnersCard({ gh }: { gh: GithubModel }) {
  const stats = gh.stats.value
  if (!stats) return null
  return (
    <Card>
      <CardTitle>Top Owners</CardTitle>
      <ol className="space-y-1 text-sm">
        {stats.topOwners.map((o) => (
          <li key={o.owner}>
            <button
              type="button"
              className={cn(rowCls, 'w-full text-left')}
              onClick={() => gh.setFilter({ owner: o.owner })}
            >
              <GitHubAvatar owner={o.owner} />
              <span className="min-w-0 flex-1 truncate text-text-2">
                {o.owner}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {o.repos} repos
              </span>
              <VisitCount n={o.visits} />
            </button>
          </li>
        ))}
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
                <GitHubKindAvatar
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
