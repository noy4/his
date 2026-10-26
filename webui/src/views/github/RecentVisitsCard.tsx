import type { GithubVisitKind, HistoryItem } from '@/app/api'
import { Card, CardTitle } from '@/components/ui/card'
import { IconToggleGroup, type IconToggleOption } from '@/components/ui/toggle-group'
import { relativeDateLabel } from '@/lib/date'
import { parseGithubTitle, parseGithubUrl } from '@his/core'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import ListIcon from '~icons/mdi/format-list-bulleted'
import GridIcon from '~icons/mdi/view-grid-outline'
import { HistoryItemRow } from '@/views/shared/HistoryRow'
import { GitHubVisitCard, GitHubVisitCardGrid } from './GitHubVisitCard'
import {
  EmptyMessage,
  FilterChip,
  GitHubItemAvatar,
  LoadMoreButton,
  RemovableChip,
} from './GitHub.components'
import type { GithubModel } from './github.model'

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

      {groups.map((group) => (
        <VisitsGroup
          key={group.label}
          label={group.label}
          items={group.items}
          isCardView={isCardView}
        />
      ))}
      {hasMore && <LoadMoreButton onClick={() => gh.loadMore()} />}
    </Card>
  )
}

// --- components ---

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

function VisitsToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('mb-2 flex flex-wrap items-center gap-1.5', className)}
    />
  )
}

const KIND_OPTIONS: { value: GithubVisitKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'repo', label: 'Repos' },
  { value: 'issue_pr', label: 'Issues/PRs' },
  { value: 'other', label: 'Other' },
]

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

const VIEW_OPTIONS: IconToggleOption[] = [
  { value: 'list', label: 'List', Icon: ListIcon },
  { value: 'card', label: 'Cards', Icon: GridIcon },
]

function VisitsViewToggle({ gh }: { gh: GithubModel }) {
  return (
    <IconToggleGroup
      aria-label="View"
      value={gh.view.value}
      onChange={(v) => gh.setView(v)}
      options={VIEW_OPTIONS}
    />
  )
}

function VisitsEmptyMessage(props: Omit<ComponentProps<'p'>, 'children'>) {
  return <EmptyMessage {...props}>No visits</EmptyMessage>
}

function VisitsGroup({ label, items, isCardView }: {
  label: string
  items: HistoryItem[]
  isCardView: boolean
}) {
  return (
    <VisitsGroupRoot>
      <VisitsGroupTitle>{label}</VisitsGroupTitle>
      {isCardView ? (
        <GitHubVisitCardGrid>
          {items.map((item) => (
            <GitHubVisitCard key={item.id} item={item} />
          ))}
        </GitHubVisitCardGrid>
      ) : (
        items.map((item) => (
          <GitHubVisitRow key={item.id} item={item} />
        ))
      )}
    </VisitsGroupRoot>
  )
}

function VisitsGroupRoot({ className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={cn('mb-2', className)} />
}

function VisitsGroupTitle({ className, ...props }: ComponentProps<'h3'>) {
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
  const titleInfo = urlInfo.root ? parseGithubTitle(item.title || item.url, urlInfo) : undefined
  return (
    <HistoryItemRow
      item={item}
      title={titleInfo && (
        <>
          <span>{urlInfo.owner}/{titleInfo.name}</span>
          {titleInfo.desc && (
            <span className="font-normal italic text-text-2">: {titleInfo.desc}</span>
          )}
        </>
      )}
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
