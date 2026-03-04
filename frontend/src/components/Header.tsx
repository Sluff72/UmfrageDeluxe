import Link from "next/link";

interface HeaderProps {
  /** Title displayed in the header */
  title: string;
  /** If provided, renders a back arrow link */
  backHref?: string;
  /** Label for the back link (default: "Zurück") */
  backLabel?: string;
  /** Optional content rendered on the right side (badges, buttons, etc.) */
  rightContent?: React.ReactNode;
}

export default function Header({
  title,
  backHref,
  backLabel = "Zurück",
  rightContent,
}: HeaderProps) {
  return (
    <header role="banner" className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <nav className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4" aria-label="Hauptnavigation">
        {backHref && (
          <Link
            href={backHref}
            className="shrink-0 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            aria-label={backLabel}
          >
            &larr;{" "}
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-zinc-900 sm:text-xl dark:text-zinc-50">
            {title}
          </h1>
        </div>
        {rightContent && (
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">{rightContent}</div>
        )}
      </nav>
    </header>
  );
}
