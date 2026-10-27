import type { HistoryItem, YoutubeVisitKind } from '@/app/api'
import { Card, CardTitle } from '@/components/ui/card'
import { ToggleChip } from '@/components/ui/toggle-chip'
import { parseYoutubeTitle, parseYoutubeUrl } from '@his/core'
import { HistoryItemRow } from '@/views/shared/HistoryRow'
import { EmptyMessage, ItemsGroupRoot, ItemsGroupTitle, ItemsToolbarRoot, ItemsViewToggle, LoadMoreButton } from '@/views/shared/RecentItems'
import { groupItemsByDate } from '@/views/shared/group-items'
import { YoutubeItemCard, YoutubeItemCardGrid } from './YoutubeItemCard'
import { YoutubeItemAvatar } from './Youtube.components'
import { YOUTUBE_KIND_LABELS } from './youtube.labels'
import type { YoutubeModel } from './youtube.model'

export function YoutubeRecentItemsCard({ yt }: { yt: YoutubeModel }) {
  const hasMore = yt.nextCursor.value !== null
  const isCardView = yt.view.value === 'card'
  const groups = groupItemsByDate(yt.visits.value)

  return (
    <Card>
      <CardTitle>Recent Items</CardTitle>
      <ItemsToolbarRoot>
        <ItemsKindFilter yt={yt} />
        <span className="ml-auto" />
        <ItemsViewToggle
          value={yt.view.value}
          onChange={(v) => yt.setView(v)}
        />
      </ItemsToolbarRoot>

      {groups.length === 0 && <EmptyMessage text="No items" />}

      {groups.map((group) => (
        <ItemsGroup
          key={group.label}
          label={group.label}
          items={group.items}
          isCardView={isCardView}
        />
      ))}
      {hasMore && <LoadMoreButton onClick={() => yt.loadMore()} />}
    </Card>
  )
}

// --- components ---

const KIND_OPTIONS: { value: YoutubeVisitKind; label: string }[] = [
  { value: 'all', label: YOUTUBE_KIND_LABELS.all },
  { value: 'video', label: YOUTUBE_KIND_LABELS.video },
  { value: 'shorts', label: YOUTUBE_KIND_LABELS.shorts },
  { value: 'channel', label: YOUTUBE_KIND_LABELS.channel },
  { value: 'playlist', label: YOUTUBE_KIND_LABELS.playlist },
  { value: 'other', label: YOUTUBE_KIND_LABELS.other },
]

function ItemsKindFilter({ yt }: { yt: YoutubeModel }) {
  const kind = yt.kind.value
  return (
    <>
      {KIND_OPTIONS.map(({ value, label }) => (
        <ToggleChip
          key={value}
          selected={kind === value}
          onClick={() => yt.setKind(value)}
        >
          {label}
        </ToggleChip>
      ))}
    </>
  )
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
        <YoutubeItemCardGrid>
          {items.map((item) => (
            <YoutubeItemCard key={item.id} item={item} />
          ))}
        </YoutubeItemCardGrid>
      ) : (
        items.map((item) => (
          <YoutubeItemRow key={item.id} item={item} />
        ))
      )}
    </ItemsGroupRoot>
  )
}

function YoutubeItemRow({ item }: { item: HistoryItem }) {
  const info = parseYoutubeUrl(item.url)
  if (!info) return null
  const { name } = parseYoutubeTitle(item.title || item.url, info)
  return (
    <HistoryItemRow
      item={item}
      title={name}
      icon={<YoutubeItemAvatar info={info} size={24} />}
    />
  )
}
