import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsContentRoot, StatsHeaderRoot } from '@/components/view/Stats'
import { ViewRoot } from '@/components/view/ViewRoot'

export function KeywordsSkeleton() {
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
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Daily Searches</CardTitle>
          <Skeleton className="h-40" />
        </Card>
      </StatsContentRoot>
      <div className="mt-4">
        <Card>
          <CardTitle>Recent Searches</CardTitle>
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </ViewRoot>
  )
}
