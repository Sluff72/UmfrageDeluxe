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
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
        {backHref && (
          <Link
            href={backHref}
            className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            &larr; {backLabel}
          </Link>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
        </div>
        {rightContent && (
          <div className="flex items-center gap-4">{rightContent}</div>
        )}
      </div>
    </header>
  );
}
