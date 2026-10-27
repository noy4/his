import type { AppModel } from '@/app/app'
import { useModel } from '@/lib/useModel'
import { MonthNav, PeriodToggle, StatsHeaderRoot } from '@/views/shared/Stats'
import { ViewRoot } from '@/views/shared/ViewRoot'
import { RecentItemsCard } from './RecentItemsCard'
import { YoutubeModel } from './youtube.model'

export function Youtube({ app }: { app: AppModel }) {
  const yt = useModel(() => new YoutubeModel(app.api))
  const monthly = yt.mode.value === 'month'

  return (
    <ViewRoot>
      <StatsHeaderRoot>
        {monthly ? (
          <MonthNav
            value={yt.monthKey.value}
            onPrev={() => yt.shiftMonth(-1)}
            onNext={() => yt.shiftMonth(1)}
          />
        ) : (
          <div />
        )}
        <PeriodToggle
          value={yt.mode.value}
          onChange={(m) => yt.setMode(m)}
          options={[
            { value: 'month', label: 'Monthly' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </StatsHeaderRoot>
      <RecentItemsCard yt={yt} />
    </ViewRoot>
  )
}
