import type { GithubVisitKind, HistoryItem } from '@his/core'
import { Card, CardTitle } from '@/components/ui/card'
import { ToggleChip } from '@/components/ui/toggle-chip'
import { parseGithubTitle, parseGithubUrl } from '@his/core'
import { HistoryItemRow } from '@/components/view/HistoryRow'
import { EmptyMessage, ItemsGroupRoot, ItemsGroupTitle, ItemsToolbarRoot, ItemsViewToggle, LoadMoreButton } from '@/components/view/RecentItems'
import { groupItemsByDate } from '@/components/view/group-items'
import { GithubItemCard, GithubItemCardGrid } from './GithubItemCard'
import { GithubItemAvatar, RemovableChip } from './Github.components'
import type { GithubModel } from './github.model'

export function GithubRecentItemsCard({ gh }: { gh: GithubModel }) {
  const hasMore = gh.nextCursor.value !== null
  const isCardView = gh.view.value === 'card'
  const groups = groupItemsByDate(gh.visits.value)

  return (
    <Card className="mt-4">
      <CardTitle>Recent Items</CardTitle>
      <ItemsToolbarRoot>
        <GithubItemsKindFilter gh={gh} />
        <span className="ml-auto" />
        <GithubItemsActiveFilter gh={gh} />
        <ItemsViewToggle
          value={gh.view.value}
          onChange={(v) => gh.setView(v)}
        />
      </ItemsToolbarRoot>

      {groups.length === 0 && <EmptyMessage text="No items" />}

      {groups.map((group) => (
        <GithubItemsGroup
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

const KIND_OPTIONS: { value: GithubVisitKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'repo', label: 'Repos' },
  { value: 'issue_pr', label: 'Issues/PRs' },
  { value: 'other', label: 'Other' },
]

function GithubItemsKindFilter({ gh }: { gh: GithubModel }) {
  const kind = gh.kind.value
  return (
    <>
      {KIND_OPTIONS.map(({ value, label }) => (
        <ToggleChip
          key={value}
          selected={kind === value}
          onClick={() => gh.setKind(value)}
        >
          {label}
        </ToggleChip>
      ))}
    </>
  )
}

function GithubItemsActiveFilter({ gh }: { gh: GithubModel }) {
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

function GithubItemsGroup({ label, items, isCardView }: {
  label: string
  items: HistoryItem[]
  isCardView: boolean
}) {
  return (
    <ItemsGroupRoot>
      <ItemsGroupTitle>{label}</ItemsGroupTitle>
      {isCardView ? (
        <GithubItemCardGrid>
          {items.map((item) => (
            <GithubItemCard key={item.id} item={item} />
          ))}
        </GithubItemCardGrid>
      ) : (
        items.map((item) => (
          <GithubItemRow key={item.id} item={item} />
        ))
      )}
    </ItemsGroupRoot>
  )
}

function GithubItemRow({ item }: { item: HistoryItem }) {
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
        <GithubItemAvatar
          owner={urlInfo.owner}
          kind={urlInfo.kind}
          size={24}
        />
      )}
    />
  )
}
