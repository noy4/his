import { Card, ListSkeleton, Sk, StatsContentRoot, StatsHeaderRoot, StatsRoot } from '../stats/Stats.components'

export function GitHubSkeleton() {
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
        <Card title="Top repos"><ListSkeleton /></Card>
        <Card title="Top owners"><ListSkeleton /></Card>
        <Card title="Top Issues / PRs"><ListSkeleton /></Card>
        <div className="col-span-full">
          <Card title="Recent visits">
            <div className="mb-3 flex gap-1.5">
              {Array.from({ length: 4 }, (_, i) => <Sk key={i} className="h-5 w-12 rounded-full" />)}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2">
                  <Sk className="size-6 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Sk className="h-3.5 w-2/3" />
                    <Sk className="h-2.5 w-1/2" />
                  </div>
                  <Sk className="h-3 w-12" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </StatsContentRoot>
    </StatsRoot>
  )
}
