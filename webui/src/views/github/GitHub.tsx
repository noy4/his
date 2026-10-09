import { dateLabel } from '@/lib/date'
import { fmtNum } from '@/lib/format'
import { Count } from './GitHub.components'
import { useModel } from '@/lib/useModel'
import type { AppModel } from '@/models/app'
import dayjs from 'dayjs'
import AccountIcon from '~icons/mdi/account-group-outline'
import EyeIcon from '~icons/mdi/eye-outline'
import PullIcon from '~icons/octicon/git-pull-request-16'
import RepoIcon from '~icons/octicon/repo-16'
import {
  Card,
  MonthNav,
  SegmentedControl,
  Stat,
  StatsContentRoot,
  StatsHeaderRoot,
  StatsRoot,
} from '../stats/Stats.components'
import { KindAvatar, RecentVisits } from './GitHub.components'
import { GithubModel } from './github.model'
import { GitHubSkeleton } from './GitHub.skeleton'

const TOP_LIMIT = 5
const rowCls = '-mx-1 flex items-center gap-2 rounded px-1 hover:bg-bg-3'

export function GitHub({ app }: { app: AppModel }) {
  const gh = useModel(() => new GithubModel(app.api))
  const stats = gh.stats.value
  if (!stats) return <GitHubSkeleton />

  const monthly = gh.mode.value === 'month'

  return (
    <StatsRoot>
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
        <SegmentedControl
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
        <RecentVisits gh={gh} />
      </StatsContentRoot>
    </StatsRoot>
  )
}

// --- components ---

function OverviewCard({ gh }: { gh: GithubModel }) {
  const stats = gh.stats.value
  if (!stats) return null
  const totals = stats.totals
  const monthly = gh.mode.value === 'month'
  return (
    <Card title="Overview">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="visits" value={fmtNum(totals.visits)} icon={<EyeIcon width={14} height={14} />} />
        <Stat label="repos" value={fmtNum(totals.repos)} icon={<RepoIcon width={14} height={14} />} />
        <Stat label="owners" value={fmtNum(totals.owners)} icon={<AccountIcon width={14} height={14} />} />
        <Stat label="Issues / PRs" value={fmtNum(totals.items)} icon={<PullIcon width={14} height={14} />} />
      </div>
      <p className="mt-3 text-xs text-muted">
        {monthly
          ? dayjs(`${gh.monthKey.value}-01`).format('MMM YYYY')
          : `${dateLabel(totals.firstVisit)} → ${dateLabel(totals.lastVisit)}`}
      </p>
    </Card>
  )
}

function TopReposCard({ gh }: { gh: GithubModel }) {
  const stats = gh.stats.value
  if (!stats) return null
  return (
    <Card title="Top repos">
      <ol className="space-y-1 text-sm">
        {stats.topRepos.slice(0, TOP_LIMIT).map((r) => (
          <li key={`${r.owner}/${r.repo}`}>
            <button type="button" className={`${rowCls} w-full text-left`} onClick={() => gh.setFilter({ owner: r.owner, repo: r.repo })}>
              <img src={`https://github.com/${r.owner}.png?size=36`} alt="" className="size-[18px] shrink-0 rounded-full bg-bg-3" />
              <span className="min-w-0 flex-1 truncate text-text-2">
                <span className="text-muted">{r.owner}/</span>{r.repo}
              </span>
              <Count n={r.visits} />
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
    <Card title="Top owners">
      <ol className="space-y-1 text-sm">
        {stats.topOwners.slice(0, TOP_LIMIT).map((o) => (
          <li key={o.owner}>
            <button type="button" className={`${rowCls} w-full text-left`} onClick={() => gh.setFilter({ owner: o.owner })}>
              <img src={`https://github.com/${o.owner}.png?size=36`} alt="" className="size-[18px] shrink-0 rounded-full bg-bg-3" />
              <span className="min-w-0 flex-1 truncate text-text-2">{o.owner}</span>
              <span className="shrink-0 text-xs text-muted">{o.repos} repos</span>
              <Count n={o.visits} />
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
    <Card title="Top Issues / PRs">
      <ol className="space-y-1.5 text-sm">
        {stats.topItems.slice(0, TOP_LIMIT).map((it) => {
          return (
            <li key={it.url}>
              <a className={`${rowCls} items-start`} href={it.url} target="_blank" rel="noreferrer">
                <span className="mt-0.5 shrink-0">
                  <KindAvatar owner={it.owner} kind={it.kind} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-text-2">{it.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {it.owner}/{it.repo}#{it.number}
                  </span>
                </span>
                <Count n={it.visits} />
              </a>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
