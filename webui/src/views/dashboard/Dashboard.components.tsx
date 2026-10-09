import { Card, CardTitle, ListSkeleton, Sk, StatsContentRoot, StatsHeaderRoot, StatsRoot } from '../stats/Stats.components'

export function DashboardSkeleton() {
  return (
    <StatsRoot>
      <StatsHeaderRoot>
        <Sk className="h-8 w-36" />
        <Sk className="h-8 w-44" />
      </StatsHeaderRoot>
      <StatsContentRoot>
        <Card>
          <CardTitle>Overview</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Sk className="h-7 w-20" />
                <Sk className="h-3 w-16" />
              </div>
            ))}
          </div>
          <Sk className="mt-3 h-3 w-32" />
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardTitle>By Hour of Day</CardTitle>
            <Sk className="h-32" />
          </Card>
          <Card>
            <CardTitle>By Day of Week</CardTitle>
            <Sk className="h-32" />
          </Card>
        </div>
        <Card>
          <CardTitle>Top Domains</CardTitle>
          <ListSkeleton />
        </Card>
        <Card>
          <CardTitle>Busiest Days</CardTitle>
          <ListSkeleton />
        </Card>
      </StatsContentRoot>
    </StatsRoot>
  )
}
