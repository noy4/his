import { Card, CardTitle } from '@/components/ui/card'
import { ToggleChip } from '@/components/ui/toggle-chip'
import dayjs from 'dayjs'
import { useState } from 'react'
import { isoDay } from '@/lib/date'
import { ALL_TIME_DAYS, dailySeries } from '@/lib/time-series'
import { YoutubeDailyVisitsChart, type YoutubeDayKey } from './YoutubeDailyVisitsChart'
import type { YoutubeModel } from './youtube.model'

const KINDS: { value: YoutubeDayKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'other', label: 'Other' },
]

const ZERO = { all: 0, video: 0, shorts: 0, other: 0 }

export function YoutubeDailyVisitsCard({ yt }: { yt: YoutubeModel }) {
  const [kind, setKind] = useState<YoutubeDayKey>('all')
  const stats = yt.stats.value
  if (!stats) return null

  const daily = (() => {
    if (yt.period.monthly.value) {
      const start = `${yt.period.monthKey.value}-01`
      return dailySeries(stats.byDay, start, dayjs(start).endOf('month').format('YYYY-MM-DD'), ZERO)
    }
    const { firstVisit, lastVisit } = stats.totals
    if (lastVisit === 0) return []
    const end = dayjs(lastVisit)
    const from = Math.max(firstVisit, end.subtract(ALL_TIME_DAYS - 1, 'day').valueOf())
    return dailySeries(stats.byDay, isoDay(from), isoDay(lastVisit), ZERO)
  })()

  return (
    <Card>
      <CardTitle>Daily Visits</CardTitle>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {KINDS.map((k) => (
          <ToggleChip
            key={k.value}
            selected={kind === k.value}
            onClick={() => setKind(k.value)}
          >
            {k.label}
          </ToggleChip>
        ))}
      </div>
      <YoutubeDailyVisitsChart data={daily} dataKey={kind} />
    </Card>
  )
}
