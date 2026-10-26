import { Skeleton } from '@/components/ui/skeleton'

export function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="size-4.5" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  )
}
