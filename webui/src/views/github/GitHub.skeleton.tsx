import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ListSkeleton } from '@/views/shared/ListSkeleton'
import { StatsContentRoot, StatsHeaderRoot } from '@/views/shared/Stats'
import { ViewRoot } from '@/views/shared/ViewRoot'

export function GitHubSkeleton() {
  return (
    <ViewRoot>
      <StatsHeaderRoot>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-44" />
      </StatsHeaderRoot>
      <StatsContentRoot>
        <Card>
          <CardTitle>Overview</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-3 h-3 w-32" />
        </Card>
        <Card>
          <CardTitle>Top Repos</CardTitle>
          <ListSkeleton />
        </Card>
        <Card>
          <CardTitle>Top Owners</CardTitle>
          <ListSkeleton />
        </Card>
        <Card>
          <CardTitle>Top Issues / PRs</CardTitle>
          <ListSkeleton />
        </Card>
      </StatsContentRoot>
      <div className="mt-4">
        <Card>
          <CardTitle>Recent Items</CardTitle>
          <div className="mb-3 flex gap-1.5">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5 w-12 rounded-full" />)}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2">
                <Skeleton className="size-6 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </ViewRoot>
  )
}
