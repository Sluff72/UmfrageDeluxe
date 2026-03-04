import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 text-5xl font-bold text-zinc-200 dark:text-zinc-800">
          404
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Seite nicht gefunden
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Zum Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
