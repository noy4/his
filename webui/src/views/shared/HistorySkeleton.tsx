import { Skeleton } from '@/components/ui/skeleton'
import { cn } from 'cn'

const ROWS = 10

export function HistorySkeleton({ view, className }: { view: string; className?: string }) {
  if (view === 'card') return <HistoryCardGridSkeleton className={className} />
  return <HistoryListSkeleton className={className} />
}

function HistoryListSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid', className)}>
      {Array.from({ length: ROWS }, (_, i) => (
        <div key={i} className="flex min-w-0 items-center gap-2.5 px-2 py-2">
          <Skeleton className="size-7.5 shrink-0 rounded-md" />
          <div className="grid min-w-0 flex-1 gap-1">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  )
}

function HistoryCardGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2', className)}>
      {Array.from({ length: ROWS }, (_, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border p-3">
          <div className="flex min-w-0 flex-col items-start gap-2.5">
            <Skeleton className="size-7 shrink-0 rounded-md" />
            <div className="grid w-full min-w-0 gap-1">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
          <div className="mt-auto flex items-center justify-end gap-2">
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  )
}
