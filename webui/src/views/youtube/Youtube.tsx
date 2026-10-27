import type { AppModel } from '@/app/app'
import { useModel } from '@/lib/useModel'
import { MonthNav, PeriodToggle, StatsHeaderRoot } from '@/views/shared/Stats'
import { ViewRoot } from '@/views/shared/ViewRoot'
import { YoutubeRecentItemsCard } from './YoutubeRecentItemsCard'
import { YoutubeModel } from './youtube.model'

export function Youtube({ app }: { app: AppModel }) {
  const yt = useModel(() => new YoutubeModel(app.api))
  const monthly = yt.period.mode.value === 'month'

  return (
    <ViewRoot>
      <StatsHeaderRoot>
        {monthly ? (
          <MonthNav
            value={yt.period.monthKey.value}
            onPrev={() => yt.period.shiftMonth(-1)}
            onNext={() => yt.period.shiftMonth(1)}
          />
        ) : (
          <div />
        )}
        <PeriodToggle value={yt.period.mode.value} onChange={(m) => yt.period.setMode(m)} />
      </StatsHeaderRoot>
      <YoutubeRecentItemsCard yt={yt} />
    </ViewRoot>
  )
}
