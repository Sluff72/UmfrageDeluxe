import { Skeleton, SkeletonLine } from "@/components/Skeleton";

export default function SurveyDetailLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header skeleton */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <SkeletonLine width="w-24" className="mb-3 h-3.5" />
              <SkeletonLine width="w-full" className="h-4" />
              <SkeletonLine width="w-3/4" className="mt-2 h-4" />
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <SkeletonLine width="w-32" className="mb-4 h-3.5" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <SkeletonLine width="w-20" className="mb-4 h-3.5" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <SkeletonLine key={i} width="w-full" className="h-4" />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <SkeletonLine width="w-24" className="mb-4 h-3.5" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
