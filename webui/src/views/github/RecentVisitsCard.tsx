import type { GithubVisitKind, HistoryItem } from '@/api'
import { ToggleGroupButton, ToggleGroupRoot } from '@/components/ui/toggle-group'
import { relativeDateLabel } from '@/lib/date'
import { parseGithubUrl } from '@his/core/github'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import ListIcon from '~icons/mdi/format-list-bulleted'
import GridIcon from '~icons/mdi/view-grid-outline'
import { HistoryRow } from '../HistoryRow'
import { Card, CardTitle } from '../stats/Stats.components'
import { CardGrid, GitHubVisitCard } from './GitHub.cards'
import {
  EmptyMessage,
  FilterChip,
  GitHubItemAvatar,
  LoadMoreButton,
  RemovableChip,
} from './GitHub.components'
import type { GithubModel } from './github.model'

const KIND_OPTIONS: { value: GithubVisitKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'repo', label: 'Repos' },
  { value: 'code', label: 'Code' },
  { value: 'issue_pr', label: 'Issues/PRs' },
]

export function RecentVisitsCard({ gh }: { gh: GithubModel }) {
  const hasMore = gh.nextCursor.value !== null
  const isCardView = gh.view.value === 'card'
  const groups = groupVisitsByDate(gh.visits.value)

  return (
    <Card className="mt-4">
      <CardTitle>Recent Visits</CardTitle>
      <VisitsToolbarRoot>
        <VisitsKindFilter gh={gh} />
        <span className="ml-auto" />
        <VisitsActiveFilter gh={gh} />
        <VisitsViewToggle gh={gh} />
      </VisitsToolbarRoot>

      {groups.length === 0 && <VisitsEmptyMessage />}

      {groups.map((g) => (
        <VisitsGroupRoot key={g.label}>
          <VisitsGroupTitle>{g.label}</VisitsGroupTitle>
          {isCardView ? (
            <CardGrid>
              {g.items.map((item) => (
                <GitHubVisitCard key={item.id} item={item} />
              ))}
            </CardGrid>
          ) : (
            g.items.map((item) => (
              <GitHubVisitRow key={item.id} item={item} />
            ))
          )}
        </VisitsGroupRoot>
      ))}
      {hasMore && <LoadMoreButton onClick={() => gh.loadMore()} />}
    </Card>
  )
}

function groupVisitsByDate(visits: HistoryItem[]) {
  const groups: { label: string; items: HistoryItem[] }[] = []
  for (const v of visits) {
    const label = relativeDateLabel(v.lastVisit)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(v)
    else groups.push({ label, items: [v] })
  }
  return groups
}

export function VisitsToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('mb-2 flex flex-wrap items-center gap-1.5', className)}
    />
  )
}

function VisitsKindFilter({ gh }: { gh: GithubModel }) {
  const kind = gh.kind.value
  return (
    <>
      {KIND_OPTIONS.map(({ value, label }) => (
        <FilterChip
          key={value}
          selected={kind === value}
          onClick={() => gh.setKind(value)}
        >
          {label}
        </FilterChip>
      ))}
    </>
  )
}

function VisitsActiveFilter({ gh }: { gh: GithubModel }) {
  const filter = gh.filter.value
  if (!filter) return null
  const label = filter.repo ? `${filter.owner}/${filter.repo}` : filter.owner
  return (
    <RemovableChip
      onRemove={() => gh.setFilter(null)}
      removeLabel={`Remove filter: ${label}`}
      label={label}
    />
  )
}

function VisitsViewToggle({ gh }: { gh: GithubModel }) {
  const v = gh.view.value
  const opts = [
    { value: 'list', label: 'List', Icon: ListIcon },
    { value: 'card', label: 'Cards', Icon: GridIcon },
  ] as const
  return (
    <ToggleGroupRoot aria-label="View">
      {opts.map(({ value, label, Icon }) => (
        <ToggleGroupButton
          key={value}
          title={label}
          aria-label={label}
          selected={v === value}
          onClick={() => gh.setView(value)}
        >
          <Icon width={14} height={14} />
        </ToggleGroupButton>
      ))}
    </ToggleGroupRoot>
  )
}

export function VisitsEmptyMessage(props: Omit<ComponentProps<'p'>, 'children'>) {
  return <EmptyMessage {...props}>No visits</EmptyMessage>
}

export function VisitsGroupRoot({ className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={cn('mb-2', className)} />
}

export function VisitsGroupTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      {...props}
      className={cn('sticky -top-4 z-10 bg-bg-2 py-1 text-xs font-semibold text-muted', className)}
    />
  )
}

function GitHubVisitRow({ item }: { item: HistoryItem }) {
  const urlInfo = parseGithubUrl(item.url)
  if (!urlInfo) return null
  return (
    <HistoryRow
      item={item}
      icon={(
        <GitHubItemAvatar
          owner={urlInfo.owner}
          kind={urlInfo.kind}
          size={24}
        />
      )}
    />
  )
}
