import type { HistoryItem, YoutubeVisitKind } from '@/app/api'
import { Card, CardTitle } from '@/components/ui/card'
import { IconToggleGroup, type IconToggleOption } from '@/components/ui/toggle-group'
import { relativeDateLabel } from '@/lib/date'
import { parseYoutubeTitle, parseYoutubeUrl } from '@his/core'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import ListIcon from '~icons/mdi/format-list-bulleted'
import GridIcon from '~icons/mdi/view-grid-outline'
import { HistoryItemRow } from '@/views/shared/HistoryRow'
import { YoutubeItemCard, YoutubeItemCardGrid } from './YoutubeItemCard'
import {
  EmptyMessage,
  FilterChip,
  LoadMoreButton,
  YoutubeItemAvatar,
} from './Youtube.components'
import { YOUTUBE_KIND_LABELS } from './youtube.labels'
import type { YoutubeModel } from './youtube.model'

export function RecentItemsCard({ yt }: { yt: YoutubeModel }) {
  const hasMore = yt.nextCursor.value !== null
  const isCardView = yt.view.value === 'card'
  const groups = groupItemsByDate(yt.visits.value)

  return (
    <Card>
      <CardTitle>Recent Items</CardTitle>
      <ItemsToolbarRoot>
        <ItemsKindFilter yt={yt} />
        <span className="ml-auto" />
        <ItemsViewToggle yt={yt} />
      </ItemsToolbarRoot>

      {groups.length === 0 && <EmptyMessage>No items</EmptyMessage>}

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
        <FilterChip
          key={value}
          selected={kind === value}
          onClick={() => yt.setKind(value)}
        >
          {label}
        </FilterChip>
      ))}
    </>
  )
}

const VIEW_OPTIONS: IconToggleOption[] = [
  { value: 'list', label: 'List', Icon: ListIcon },
  { value: 'card', label: 'Cards', Icon: GridIcon },
]

function ItemsViewToggle({ yt }: { yt: YoutubeModel }) {
  return (
    <IconToggleGroup
      aria-label="View"
      value={yt.view.value}
      onChange={(v) => yt.setView(v)}
      options={VIEW_OPTIONS}
    />
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
