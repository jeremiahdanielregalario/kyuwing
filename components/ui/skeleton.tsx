import { cn } from "@/lib/utils";

/** A shimmering placeholder block shown while a page loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

/** Generic page placeholder: heading, a row of actions, then cards. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading" className="animate-page-in space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-36 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

/** Live-board placeholder: tabs, stats strip, then a grid of courts. */
export function BoardSkeleton() {
  return (
    <div role="status" aria-label="Loading board" className="animate-page-in space-y-6">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-10 w-80 max-w-full" />
      </div>
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="aspect-[16/10] w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
