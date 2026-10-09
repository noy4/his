import type { GithubKind, GithubVisitKind, HistoryItem } from '@/api'
import { relativeDateLabel } from '@/lib/date'
import { parseGithubUrl } from '@his/core/github'
import CloseIcon from '~icons/mdi/close'
import ListIcon from '~icons/mdi/format-list-bulleted'
import GridIcon from '~icons/mdi/view-grid-outline'
import PullIcon from '~icons/octicon/git-pull-request-16'
import IssueIcon from '~icons/octicon/issue-opened-16'
import { Row } from '../Row'
import { Card, CardTitle } from '../stats/Stats.components'
import { CardGrid, VisitCard } from './GitHub.cards'
import { GithubModel } from './github.model'
import { fmtNum } from '@/lib/format'

// repo = repo root only · code = other repo pages except PR/Issue · issue_pr = PR + Issue
const KIND_OPTIONS: { value: GithubVisitKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'repo', label: 'Repos' },
  { value: 'code', label: 'Code' },
  { value: 'issue_pr', label: 'Issues/PRs' },
]

export function RecentVisits({ gh }: { gh: GithubModel }) {
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
      <Card>
        <CardTitle>Recent visits</CardTitle>
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

export function Avatar({ owner, size = 18 }: { owner: string; size?: number }) {
  return (
    <img
      src={`https://github.com/${owner}.png?size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-bg-3"
    />
  )
}

export function KindAvatar({ owner, kind, size = 18 }: { owner: string; kind?: GithubKind; size?: number }) {
  const Icon = kind === 'pull' ? PullIcon : IssueIcon
  const badge = Math.round(size * 0.6)
  return (
    <span className="relative block shrink-0" title={kind ? (kind === 'pull' ? 'Pull request' : 'Issue') : undefined}>
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

export function Count({ n }: { n: number }) {
  return <span title='visits count' className="shrink-0 font-mono text-xs text-muted tabular-nums">{fmtNum(n)}</span>
}
