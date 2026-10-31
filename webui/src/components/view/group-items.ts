import type { HistoryItem } from '@his/core'
import { relativeDateLabel } from '@/lib/date'

export interface ItemGroup<T = HistoryItem> {
  label: string
  items: T[]
}

// split a time-desc list into 'Today' / 'Yesterday' / date buckets
export function groupByDate<T>(items: readonly T[], key: (item: T) => number): ItemGroup<T>[] {
  const groups: ItemGroup<T>[] = []
  for (const item of items) {
    const label = relativeDateLabel(key(item))
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

export function groupItemsByDate(items: HistoryItem[]): ItemGroup<HistoryItem>[] {
  return groupByDate(items, (item) => item.lastVisit)
}
