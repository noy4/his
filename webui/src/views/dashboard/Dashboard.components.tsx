import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ListSkeleton } from '@/views/shared/ListSkeleton'
import { StatsContentRoot, StatsHeaderRoot } from '@/views/shared/Stats'
import { ViewRoot } from '@/views/shared/ViewRoot'

export function DashboardSkeleton() {
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
          <div className="mt-4">
            <Skeleton className="h-40" />
          </div>
          <div className="mt-3 space-y-2 border-t pt-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardTitle>By Hour of Day</CardTitle>
            <Skeleton className="h-32" />
          </Card>
          <Card>
            <CardTitle>By Day of Week</CardTitle>
            <Skeleton className="h-32" />
          </Card>
        </div>
        <Card>
          <CardTitle>Top Domains</CardTitle>
          <ListSkeleton />
        </Card>
      </StatsContentRoot>
    </ViewRoot>
  )
}
