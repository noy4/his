import type { AppModel } from '@/app/app'
import { Card, CardTitle } from '@/components/ui/card'
import { dateLabel } from '@/lib/date'
import { fmtNum } from '@/lib/format'
import { MonthNav, PeriodToggle } from '@/lib/period/Period'
import { useModel } from '@/lib/useModel'
import BoltIcon from '~icons/mdi/lightning-bolt'
import EyeIcon from '~icons/mdi/eye-outline'
import VideoIcon from '~icons/mdi/video-outline'
import { Stat, StatsContentRoot, StatsHeaderRoot } from '@/views/shared/Stats'
import { ViewRoot } from '@/views/shared/ViewRoot'
import { YoutubeRecentItemsCard } from './YoutubeRecentItemsCard'
import { YoutubeSkeleton } from './YoutubeSkeleton'
import { YoutubeModel } from './youtube.model'

const DAY = 86_400_000

export function Youtube({ app }: { app: AppModel }) {
  const yt = useModel(() => new YoutubeModel(app.api))
  const stats = yt.stats.value
  if (!stats) return <YoutubeSkeleton />
  const monthly = yt.period.monthly.value

  return (
    <ViewRoot>
      <StatsHeaderRoot>
        {monthly ? <MonthNav period={yt.period} /> : <div />}
        <PeriodToggle period={yt.period} />
      </StatsHeaderRoot>
      <StatsContentRoot>
        <OverviewCard yt={yt} />
      </StatsContentRoot>
      <YoutubeRecentItemsCard yt={yt} />
    </ViewRoot>
  )
}

// --- components ---

function OverviewCard({ yt }: { yt: YoutubeModel }) {
  const stats = yt.stats.value
  if (!stats) return null
  const totals = stats.totals
  const days = Math.round((totals.lastVisit - totals.firstVisit) / DAY) + 1
  const monthly = yt.period.monthly.value
  return (
    <Card>
      <CardTitle>Overview</CardTitle>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="visits" value={fmtNum(totals.visits)} icon={EyeIcon} />
        <Stat label="videos" value={fmtNum(totals.videos)} icon={VideoIcon} />
        <Stat label="shorts" value={fmtNum(totals.shorts)} icon={BoltIcon} />
      </div>
      {!monthly && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted">Period</span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="font-mono tabular-nums">
              {dateLabel(totals.firstVisit)} - {dateLabel(totals.lastVisit)}
            </span>
            <span className="font-mono tabular-nums">({days}d)</span>
          </span>
        </div>
      )}
    </Card>
  )
}
