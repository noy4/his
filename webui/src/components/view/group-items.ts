import type { HistoryItem } from '@his/core'
import { relativeDateLabel } from '@/lib/date'

export interface ItemGroup {
  label: string
  items: HistoryItem[]
}

// split a last-visit-desc list into 'Today' / 'Yesterday' / date buckets
export function groupItemsByDate(items: HistoryItem[]): ItemGroup[] {
  const groups: ItemGroup[] = []
  for (const item of items) {
    const label = relativeDateLabel(item.lastVisit)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}
