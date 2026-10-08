import { Card, ListSkeleton, Sk, StatsContentRoot, StatsHeaderRoot, StatsRoot } from '../stats/Stats.components'

export function DashboardSkeleton() {
  return (
    <StatsRoot>
      <StatsHeaderRoot>
        <Sk className="h-8 w-36" />
        <Sk className="h-8 w-44" />
      </StatsHeaderRoot>
      <StatsContentRoot>
        <Card title="Overview">
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
          <Card title="By hour of day"><Sk className="h-32" /></Card>
          <Card title="By day of week"><Sk className="h-32" /></Card>
        </div>
        <Card title="Top domains"><ListSkeleton /></Card>
        <Card title="Busiest days"><ListSkeleton /></Card>
      </StatsContentRoot>
    </StatsRoot>
  )
}
