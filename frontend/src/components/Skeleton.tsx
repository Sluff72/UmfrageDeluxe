/**
 * Skeleton loading components for visual loading placeholders.
 * Uses Tailwind's animate-pulse for a subtle shimmer effect.
 */

interface SkeletonProps {
  className?: string;
}

/** Generic skeleton block – style via className */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-700 ${className}`}
    />
  );
}

/** Single text line placeholder */
export function SkeletonLine({
  className = "",
  width = "w-full",
}: SkeletonProps & { width?: string }) {
  return <Skeleton className={`h-4 ${width} ${className}`} />;
}

/** Small circular badge placeholder */
export function SkeletonBadge({ className = "" }: SkeletonProps) {
  return <Skeleton className={`h-6 w-20 rounded-full ${className}`} />;
}

/** Dashboard survey card skeleton – mimics SurveyCard layout */
export function SurveyCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <SkeletonLine width="w-48" className="h-5" />
          <SkeletonLine width="w-72" className="h-3.5" />
        </div>
        <SkeletonBadge />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <SkeletonLine width="w-24" className="h-3" />
        <SkeletonLine width="w-20" className="h-3" />
        <SkeletonLine width="w-16" className="h-3" />
      </div>
    </div>
  );
}

/** Options list skeleton – mimics a list of option items */
export function OptionsListSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <SkeletonLine width="w-32" className="mb-4 h-3.5" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"
          >
            <div className="space-y-1.5">
              <SkeletonLine width="w-40" className="h-4" />
              <SkeletonLine width="w-24" className="h-3" />
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Voting panel skeleton – mimics slider rows */
export function VotingPanelSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <SkeletonLine width="w-36" className="mb-4 h-3.5" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine width="w-32" className="h-4" />
            <Skeleton className="h-6 w-full rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-10 w-full rounded-lg" />
    </div>
  );
}

/** Results panel skeleton – mimics chart area */
export function ResultsPanelSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <SkeletonLine width="w-28" className="mb-4 h-3.5" />
      <Skeleton className="mb-4 h-48 w-full rounded-lg" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <SkeletonLine width="w-32" className="h-4" />
            <SkeletonLine width="w-16" className="h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
