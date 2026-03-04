import { SurveyCardSkeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header skeleton */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="h-6 w-36 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-8 w-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <div className="h-7 w-44 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="grid gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <SurveyCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
