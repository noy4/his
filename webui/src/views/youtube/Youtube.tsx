import type { AppModel } from '@/app/app'
import { MonthNav, PeriodToggle } from '@/lib/period/Period'
import { useModel } from '@/lib/useModel'
import { StatsHeaderRoot } from '@/views/shared/Stats'
import { ViewRoot } from '@/views/shared/ViewRoot'
import { YoutubeRecentItemsCard } from './YoutubeRecentItemsCard'
import { YoutubeModel } from './youtube.model'

export function Youtube({ app }: { app: AppModel }) {
  const yt = useModel(() => new YoutubeModel(app.api))
  const monthly = yt.period.monthly.value
  return (
    <ViewRoot>
      <StatsHeaderRoot>
        {monthly ? <MonthNav period={yt.period} /> : <div />}
        <PeriodToggle period={yt.period} />
      </StatsHeaderRoot>
      <YoutubeRecentItemsCard yt={yt} />
    </ViewRoot>
  )
}
