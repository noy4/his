// UI mock — static data only. Replace with history.githubStats RPC (see PLAN.github.html).
import type { HistoryItem } from '@/api'
import { dateLabel, relativeDateLabel } from '@/lib/date'
import { fmtNum } from '@/lib/format'
import CloseIcon from '~icons/mdi/close'
import { Row } from '../Row'
import type { AppModel } from '@/models/app'
import { signal } from '@preact/signals-react'
import dayjs from 'dayjs'
import AccountIcon from '~icons/mdi/account-group-outline'
import EyeIcon from '~icons/mdi/eye-outline'
import IssueIcon from '~icons/octicon/issue-opened-16'
import PullIcon from '~icons/octicon/git-pull-request-16'
import RepoIcon from '~icons/octicon/repo-16'
import {
  Card,
  DashboardContentRoot,
  DashboardHeaderRoot,
  DashboardRoot,
  MonthNav,
  SegmentedControl,
  Stat,
} from '../dashboard/Dashboard.components'

type Mode = 'month' | 'all'

export type GithubStats = {
  totals: { visits: number; repos: number; owners: number; items: number; firstVisit: number; lastVisit: number }
  topRepos: { owner: string; repo: string; visits: number }[]
  topOwners: { owner: string; repos: number; visits: number }[]
  topItems: {
    owner: string
    repo: string
    kind: 'pull' | 'issue'
    number: number
    title: string
    url: string
    visits: number
  }[]
}

const MOCK: GithubStats = {
  totals: { visits: 1842, repos: 67, owners: 31, items: 124, firstVisit: Date.parse('2024-03-12'), lastVisit: Date.now() },
  topRepos: [
    { owner: 'kilo-org', repo: 'kilocode', visits: 312 },
    { owner: 'facebook', repo: 'react', visits: 188 },
    { owner: 'preactjs', repo: 'signals', visits: 142 },
    { owner: 'vitejs', repo: 'vite', visits: 97 },
    { owner: 'oven-sh', repo: 'bun', visits: 83 },
    { owner: 'tailwindlabs', repo: 'tailwindcss', visits: 61 },
    { owner: 'noy', repo: 'his', visits: 54 },
    { owner: 'microsoft', repo: 'typescript', visits: 40 },
  ],
  topOwners: [
    { owner: 'kilo-org', repos: 4, visits: 355 },
    { owner: 'facebook', repos: 3, visits: 214 },
    { owner: 'preactjs', repos: 2, visits: 150 },
    { owner: 'vitejs', repos: 2, visits: 101 },
    { owner: 'oven-sh', repos: 1, visits: 83 },
    { owner: 'microsoft', repos: 5, visits: 79 },
    { owner: 'tailwindlabs', repos: 2, visits: 66 },
    { owner: 'noy', repos: 6, visits: 60 },
  ],
  topItems: [
    { owner: 'kilo-org', repo: 'kilocode', kind: 'pull', number: 4821, title: 'Agent Manager: worktree sections', url: 'https://github.com/kilo-org/kilocode/pull/4821', visits: 38 },
    { owner: 'facebook', repo: 'react', kind: 'issue', number: 31204, title: 'useEffectEvent stabilization', url: 'https://github.com/facebook/react/issues/31204', visits: 22 },
    { owner: 'preactjs', repo: 'signals', kind: 'pull', number: 612, title: 'React 19 adapter', url: 'https://github.com/preactjs/signals/pull/612', visits: 19 },
    { owner: 'vitejs', repo: 'vite', kind: 'issue', number: 18833, title: 'HMR breaks with symlinked deps', url: 'https://github.com/vitejs/vite/issues/18833', visits: 14 },
    { owner: 'oven-sh', repo: 'bun', kind: 'pull', number: 15110, title: 'bun:sqlite WAL improvements', url: 'https://github.com/oven-sh/bun/pull/15110', visits: 11 },
    { owner: 'noy', repo: 'his', kind: 'issue', number: 12, title: 'GitHub Insights page', url: 'https://github.com/noy/his/issues/12', visits: 9 },
  ],
}

// mock visits: generated from MOCK repos/items, newest first
const PAGES = ['', '/pulls', '/issues', '/actions', '/blob/main/README.md', '/tree/main/src']
const MOCK_VISITS: HistoryItem[] = (() => {
  const out: HistoryItem[] = []
  let t = Date.now()
  for (let i = 0; i < 120; i++) {
    t -= (7 + ((i * 37) % 180)) * 60_000
    const item = i % 3 === 0 ? MOCK.topItems[i % MOCK.topItems.length] : null
    const r = item ?? MOCK.topRepos[(i * 5) % MOCK.topRepos.length]
    const path = PAGES[i % PAGES.length]
    const url = item ? item.url : `https://github.com/${r.owner}/${r.repo}${path}`
    out.push({
      id: i,
      url,
      title: item ? `${item.title} · ${r.owner}/${r.repo}#${item.number}` : `${r.owner}/${r.repo}${path}`,
      visitCount: 1 + (i % 4 === 0 ? i % 5 : 0),
      typedCount: 0,
      firstVisit: t,
      lastVisit: t,
    })
  }
  return out
})()

type Filter = { owner: string; repo?: string } | null
const filter = signal<Filter>(null)
const limit = signal(30)

// 'code' = PR/Issue 以外の repo ページ（命名検討中: Code / Pages / Other）
type KindFilter = 'all' | 'code' | 'pull' | 'issue'
const kindFilter = signal<KindFilter>('all')
const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'code', label: 'Code' },
  { value: 'pull', label: 'PRs' },
  { value: 'issue', label: 'Issues' },
]

function matchesKind(url: string, k: KindFilter): boolean {
  if (k === 'all') return true
  const kind = kindOf(url)
  return k === 'code' ? !kind : kind === k
}

function setFilter(next: Filter) {
  filter.value = next
  limit.value = 30
}

function matches(url: string, f: Filter): boolean {
  if (!f) return true
  const [, owner, repo] = new URL(url).pathname.toLowerCase().split('/')
  return owner === f.owner && (!f.repo || repo === f.repo)
}

const mode = signal<Mode>('month')
const monthKey = signal(dayjs().format('YYYY-MM'))

function shiftMonth(delta: number) {
  monthKey.value = dayjs(`${monthKey.value}-01`).add(delta, 'month').format('YYYY-MM')
}

function Count({ n }: { n: number }) {
  return <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(n)}</span>
}

const rowCls = '-mx-1 flex items-center gap-2 rounded px-1 hover:bg-bg-3'

export function GitHub(_: { app: AppModel }) {
  const stats = MOCK
  const { totals } = stats
  const monthly = mode.value === 'month'

  return (
    <DashboardRoot>
      <DashboardHeaderRoot>
        {monthly ? (
          <MonthNav value={monthKey.value} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
        ) : (
          <div />
        )}
        <SegmentedControl
          value={mode.value}
          onChange={(m) => (mode.value = m)}
          options={[
            { value: 'month', label: 'Monthly' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </DashboardHeaderRoot>

      <DashboardContentRoot>
        <Card title="Overview">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="visits" value={fmtNum(totals.visits)} icon={<EyeIcon width={14} height={14} />} />
            <Stat label="repos" value={fmtNum(totals.repos)} icon={<RepoIcon width={14} height={14} />} />
            <Stat label="owners" value={fmtNum(totals.owners)} icon={<AccountIcon width={14} height={14} />} />
            <Stat label="PRs / issues" value={fmtNum(totals.items)} icon={<PullIcon width={14} height={14} />} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {monthly ? dayjs(`${monthKey.value}-01`).format('MMM YYYY') : `${dateLabel(totals.firstVisit)} → ${dateLabel(totals.lastVisit)}`}
          </p>
        </Card>

        <Card title="Top repos">
          <ol className="space-y-1 text-sm">
            {stats.topRepos.map((r) => (
              <li key={`${r.owner}/${r.repo}`}>
                <button type="button" className={`${rowCls} w-full text-left`} onClick={() => setFilter({ owner: r.owner, repo: r.repo })}>
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
                <button type="button" className={`${rowCls} w-full text-left`} onClick={() => setFilter({ owner: o.owner })}>
                  <img src={`https://github.com/${o.owner}.png?size=36`} alt="" className="size-[18px] shrink-0 rounded-full bg-bg-3" />
                  <span className="min-w-0 flex-1 truncate text-text-2">{o.owner}</span>
                  <span className="shrink-0 text-xs text-muted">{o.repos} repos</span>
                  <Count n={o.visits} />
                </button>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Top PRs / issues">
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
        <RecentVisits />
      </DashboardContentRoot>
    </DashboardRoot>
  )
}

function RecentVisits() {
  const f = filter.value
  const k = kindFilter.value
  const all = MOCK_VISITS.filter((v) => matches(v.url, f) && matchesKind(v.url, k))
  const shown = all.slice(0, limit.value)
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
              onClick={() => {
                kindFilter.value = o.value
                limit.value = 30
              }}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${k === o.value ? 'border-primary bg-primary-soft text-primary' : 'text-muted hover:text-text'}`}
            >
              {o.label}
            </button>
          ))}
        {f && (
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary hover:opacity-80"
          >
            {f.repo ? `${f.owner}/${f.repo}` : f.owner}
            <CloseIcon width={12} height={12} />
          </button>
        )}
        </div>
        {groups.length === 0 && <p className="py-6 text-center text-sm text-muted">No visits</p>}
        {groups.map((g) => (
          <section key={g.label} className="mb-2">
            <h3 className="sticky top-0 bg-bg-2 py-1 text-xs font-semibold text-muted">{g.label}</h3>
            {g.items.map((v) => (
              <Row key={v.id} item={v} icon={<KindAvatar owner={ownerOf(v.url)} kind={kindOf(v.url)} size={24} />} />
            ))}
          </section>
        ))}
        {all.length > shown.length && (
          <button
            type="button"
            onClick={() => (limit.value += 30)}
            className="mt-2 w-full rounded py-1.5 text-sm text-muted hover:bg-bg-3 hover:text-text"
          >
            Show more ({fmtNum(all.length - shown.length)})
          </button>
        )}
      </Card>
    </div>
  )
}

function ownerOf(url: string): string {
  return new URL(url).pathname.split('/')[1] ?? ''
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

type Kind = 'pull' | 'issue'

function kindOf(url: string): Kind | undefined {
  const [, , , type, num] = new URL(url).pathname.split('/')
  if (!num || !/^\d+$/.test(num)) return undefined
  return type === 'pull' ? 'pull' : type === 'issues' ? 'issue' : undefined
}

function KindAvatar({ owner, kind, size = 18 }: { owner: string; kind?: Kind; size?: number }) {
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
