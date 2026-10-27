import type { AppModel } from '@/app/app'
import { Card, CardTitle } from '@/components/ui/card'
import { parseYoutubeTitle } from '@his/core'
import { cn } from 'cn'
import { dateLabel } from '@/lib/date'
import { fmtNum } from '@/lib/format'
import { MonthNav, PeriodToggle } from '@/lib/period/Period'
import { useModel } from '@/lib/useModel'
import BoltIcon from '~icons/mdi/lightning-bolt'
import EyeIcon from '~icons/mdi/eye-outline'
import VideoIcon from '~icons/mdi/video-outline'
import { VisitCount } from '@/views/shared/RecentItems'
import { Stat, StatsContentRoot, StatsHeaderRoot } from '@/views/shared/Stats'
import { ViewRoot } from '@/views/shared/ViewRoot'
import { RANK_MEDALS, RANK_MEDAL_COLORS } from '@/views/shared/rank-medals'
import { YoutubeItemAvatar } from './Youtube.components'
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
        {!monthly && <TopVideosCard yt={yt} />}
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

function TopVideosCard({ yt }: { yt: YoutubeModel }) {
  const stats = yt.stats.value
  if (!stats) return null
  return (
    <Card>
      <CardTitle>Top Videos</CardTitle>
      <ol className="space-y-1.5 text-sm">
        {stats.topVideos.map((v, i) => {
          const Medal = RANK_MEDALS[i]
          return (
            <li key={v.id}>
              <a
                className="flex items-center gap-2 rounded px-1 hover:bg-bg-3"
                href={v.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="flex w-5 shrink-0 items-center justify-center">
                  {Medal ? (
                    <Medal className={cn('size-5', RANK_MEDAL_COLORS[i])} />
                  ) : (
                    <span className="font-mono text-xs text-muted tabular-nums">{i + 1}</span>
                  )}
                </span>
                <YoutubeItemAvatar
                  info={{ kind: 'video', id: v.id, shorts: v.shorts ? true : undefined }}
                  size={24}
                />
                <span className="min-w-0 flex-1 truncate text-text-2">
                  {parseYoutubeTitle(v.title, { kind: 'video', id: v.id }).name}
                </span>
                <VisitCount n={v.visits} />
              </a>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
