import type { GithubVisitKind } from '@his/core'
import { Card, CardTitle } from '@/components/ui/card'
import { ToggleChip } from '@/components/ui/toggle-chip'
import dayjs from 'dayjs'
import { useState } from 'react'
import { isoDay } from '@/lib/date'
import { ALL_TIME_DAYS, dailySeries } from '@/lib/time-series'
import { GithubDailyVisitsChart, type GithubDailyVisitTop } from './GithubDailyVisitsChart'
import type { GithubModel } from './github.model'

const KINDS: { value: GithubVisitKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'repo', label: 'Repos' },
  { value: 'issue_pr', label: 'Issues/PRs' },
  { value: 'other', label: 'Other' },
]

const EMPTY_TOP: GithubDailyVisitTop = { repo: [], issue_pr: [], other: [] }
const ZERO = { all: 0, repo: 0, issue_pr: 0, other: 0, top: EMPTY_TOP }

export function GithubDailyVisitsCard({ gh }: { gh: GithubModel }) {
  const [kind, setKind] = useState<GithubVisitKind>('repo')
  const stats = gh.stats.value
  if (!stats) return null

  const topByDay = new Map(stats.byDayTop.map((d) => [d.day, { repo: d.repo, issue_pr: d.issue_pr, other: d.other }]))
  const source = stats.byDay.map((d) => ({ ...d, top: topByDay.get(d.day) ?? EMPTY_TOP }))
  const daily = (() => {
    if (gh.period.monthly.value) {
      const start = `${gh.period.monthKey.value}-01`
      return dailySeries(source, start, dayjs(start).endOf('month').format('YYYY-MM-DD'), ZERO)
    }
    const { firstVisit, lastVisit } = stats.totals
    if (lastVisit === 0) return []
    const end = dayjs(lastVisit)
    const from = Math.max(firstVisit, end.subtract(ALL_TIME_DAYS - 1, 'day').valueOf())
    return dailySeries(source, isoDay(from), isoDay(lastVisit), ZERO)
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
      <GithubDailyVisitsChart data={daily} dataKey={kind} />
    </Card>
  )
}
