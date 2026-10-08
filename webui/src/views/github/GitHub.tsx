import type { GithubKind, GithubVisitKind, HistoryItem } from '@/api'
import { dateLabel, relativeDateLabel } from '@/lib/date'
import { fmtNum } from '@/lib/format'
import { parseGithubUrl } from '@his/core/github'
import { useModel } from '@/lib/useModel'
import type { AppModel } from '@/models/app'
import dayjs from 'dayjs'
import AccountIcon from '~icons/mdi/account-group-outline'
import CloseIcon from '~icons/mdi/close'
import GridIcon from '~icons/mdi/view-grid-outline'
import ListIcon from '~icons/mdi/format-list-bulleted'
import EyeIcon from '~icons/mdi/eye-outline'
import IssueIcon from '~icons/octicon/issue-opened-16'
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
import { GitHubSkeleton } from './GitHub.skeleton'
import { CardGrid, VisitCard } from './GitHub.cards'
import { Row } from '../Row'
import { GithubModel } from './github.model'

// repo = repo root only · code = other repo pages except PR/Issue · issue_pr = PR + Issue
const KIND_OPTIONS: { value: GithubVisitKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'repo', label: 'Repos' },
  { value: 'code', label: 'Code' },
  { value: 'issue_pr', label: 'Issues/PRs' },
]

function Count({ n }: { n: number }) {
  return <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(n)}</span>
}

const rowCls = '-mx-1 flex items-center gap-2 rounded px-1 hover:bg-bg-3'

export function GitHub({ app }: { app: AppModel }) {
  const gh = useModel(() => new GithubModel(app.api))
  const stats = gh.stats.value
  if (!stats) return <GitHubSkeleton />

  const { totals } = stats
  const monthly = gh.mode.value === 'month'

  return (
    <StatsRoot>
      <StatsHeaderRoot>
        {monthly ? (
          <MonthNav value={gh.monthKey.value} onPrev={() => gh.shiftMonth(-1)} onNext={() => gh.shiftMonth(1)} />
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
        <Card title="Overview">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="visits" value={fmtNum(totals.visits)} icon={<EyeIcon width={14} height={14} />} />
            <Stat label="repos" value={fmtNum(totals.repos)} icon={<RepoIcon width={14} height={14} />} />
            <Stat label="owners" value={fmtNum(totals.owners)} icon={<AccountIcon width={14} height={14} />} />
            <Stat label="Issues / PRs" value={fmtNum(totals.items)} icon={<PullIcon width={14} height={14} />} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {monthly ? dayjs(`${gh.monthKey.value}-01`).format('MMM YYYY') : `${dateLabel(totals.firstVisit)} → ${dateLabel(totals.lastVisit)}`}
          </p>
        </Card>

        <Card title="Top repos">
          <ol className="space-y-1 text-sm">
            {stats.topRepos.map((r) => (
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

        <Card title="Top owners">
          <ol className="space-y-1 text-sm">
            {stats.topOwners.map((o) => (
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

        <Card title="Top Issues / PRs">
          <ol className="space-y-1.5 text-sm">
            {stats.topItems.map((it) => {
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
        <RecentVisits gh={gh} />
      </StatsContentRoot>
    </StatsRoot>
  )
}

function RecentVisits({ gh }: { gh: GithubModel }) {
  const f = gh.filter.value
  const k = gh.kind.value
  const shown = gh.visits.value
  const hasMore = gh.nextCursor.value !== null
  const cards = gh.view.value === 'card'
  const groups: { label: string; items: HistoryItem[] }[] = []
  for (const v of shown) {
    const label = relativeDateLabel(v.lastVisit)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(v)
    else groups.push({ label, items: [v] })
  }

  return (
    <div className="col-span-full">
      <Card title="Recent visits">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {KIND_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={k === o.value}
              onClick={() => gh.setKind(o.value)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${k === o.value ? 'border-primary bg-primary-soft text-primary' : 'text-muted hover:text-text'}`}
            >
              {o.label}
            </button>
          ))}
          <span className="ml-auto" />
          {f && (
          <button
            type="button"
            onClick={() => gh.setFilter(null)}
            className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary hover:opacity-80"
          >
            {f.repo ? `${f.owner}/${f.repo}` : f.owner}
            <CloseIcon width={12} height={12} />
          </button>
        )}
          <ViewToggle gh={gh} />
        </div>
        {groups.length === 0 && <p className="py-6 text-center text-sm text-muted">No visits</p>}
        {groups.map((g) => (
          <section key={g.label} className="mb-2">
            <h3 className="sticky -top-4 z-10 bg-bg-2 py-1 text-xs font-semibold text-muted">{g.label}</h3>
            {cards ? (
              <CardGrid>
                {g.items.map((v) => (
                  <VisitCard key={v.id} item={v} avatar={(owner, size) => <KindAvatar owner={owner} kind={parseGithubUrl(v.url)?.kind} size={size} />} />
                ))}
              </CardGrid>
            ) : (
              g.items.map((v) => (
                <Row key={v.id} item={v} icon={<KindAvatar owner={parseGithubUrl(v.url)?.owner ?? ''} kind={parseGithubUrl(v.url)?.kind} size={24} />} />
              ))
            )}
          </section>
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => gh.loadMore()}
            className="mt-2 w-full rounded py-1.5 text-sm text-muted hover:bg-bg-3 hover:text-text"
          >
            Show more
          </button>
        )}
      </Card>
    </div>
  )
}

function ViewToggle({ gh }: { gh: GithubModel }) {
  const v = gh.view.value
  const opts = [
    { value: 'list', label: 'List', Icon: ListIcon },
    { value: 'card', label: 'Cards', Icon: GridIcon },
  ] as const
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-sm bg-bg-3 p-0.5" role="group" aria-label="View">
      {opts.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={v === value}
          onClick={() => gh.setView(value)}
          className={`rounded p-1 transition-colors ${v === value ? 'bg-bg-2 text-text' : 'text-muted hover:text-text'}`}
        >
          <Icon width={14} height={14} />
        </button>
      ))}
    </div>
  )
}

function Avatar({ owner, size = 18 }: { owner: string; size?: number }) {
  return (
    <img
      src={`https://github.com/${owner}.png?size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      className="block shrink-0 rounded-full bg-bg-3"
    />
  )
}

function KindAvatar({ owner, kind, size = 18 }: { owner: string; kind?: GithubKind; size?: number }) {
  const Icon = kind === 'pull' ? PullIcon : IssueIcon
  const badge = Math.round(size * 0.6)
  return (
    <span className="relative block shrink-0">
      <Avatar owner={owner} size={size} />
      {kind && (
        <Icon
          width={badge}
          height={badge}
          className={`absolute -right-1 -bottom-1 rounded-full bg-bg-2 p-px ${kind === 'pull' ? 'text-primary' : 'text-muted'}`}
        />
      )}
    </span>
  )
}
