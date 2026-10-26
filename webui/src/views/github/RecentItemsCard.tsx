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
import { GitHubItemCard, GitHubItemCardGrid } from './GitHubItemCard'
import {
  EmptyMessage,
  FilterChip,
  GitHubItemAvatar,
  LoadMoreButton,
  RemovableChip,
} from './GitHub.components'
import type { GithubModel } from './github.model'

export function RecentItemsCard({ gh }: { gh: GithubModel }) {
  const hasMore = gh.nextCursor.value !== null
  const isCardView = gh.view.value === 'card'
  const groups = groupItemsByDate(gh.visits.value)

  return (
    <Card className="mt-4">
      <CardTitle>Recent Items</CardTitle>
      <ItemsToolbarRoot>
        <ItemsKindFilter gh={gh} />
        <span className="ml-auto" />
        <ItemsActiveFilter gh={gh} />
        <ItemsViewToggle gh={gh} />
      </ItemsToolbarRoot>

      {groups.length === 0 && <ItemsEmptyMessage />}

      {groups.map((group) => (
        <ItemsGroup
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

function groupItemsByDate(items: HistoryItem[]) {
  const groups: { label: string; items: HistoryItem[] }[] = []
  for (const item of items) {
    const label = relativeDateLabel(item.lastVisit)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

function ItemsToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
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

function ItemsKindFilter({ gh }: { gh: GithubModel }) {
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

function ItemsActiveFilter({ gh }: { gh: GithubModel }) {
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

function ItemsViewToggle({ gh }: { gh: GithubModel }) {
  return (
    <IconToggleGroup
      aria-label="View"
      value={gh.view.value}
      onChange={(v) => gh.setView(v)}
      options={VIEW_OPTIONS}
    />
  )
}

function ItemsEmptyMessage(props: Omit<ComponentProps<'p'>, 'children'>) {
  return <EmptyMessage {...props}>No items</EmptyMessage>
}

function ItemsGroup({ label, items, isCardView }: {
  label: string
  items: HistoryItem[]
  isCardView: boolean
}) {
  return (
    <ItemsGroupRoot>
      <ItemsGroupTitle>{label}</ItemsGroupTitle>
      {isCardView ? (
        <GitHubItemCardGrid>
          {items.map((item) => (
            <GitHubItemCard key={item.id} item={item} />
          ))}
        </GitHubItemCardGrid>
      ) : (
        items.map((item) => (
          <GitHubItemRow key={item.id} item={item} />
        ))
      )}
    </ItemsGroupRoot>
  )
}

function ItemsGroupRoot({ className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={cn('mb-2', className)} />
}

function ItemsGroupTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      {...props}
      className={cn('sticky -top-4 z-10 bg-bg-2 py-1 text-xs font-semibold text-muted', className)}
    />
  )
}

function GitHubItemRow({ item }: { item: HistoryItem }) {
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
