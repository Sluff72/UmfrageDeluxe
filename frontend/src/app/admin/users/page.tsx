"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import Header from "@/components/Header";
import { useToast } from "@/components/Toast";
import type { UserAdministrationEntry } from "@/types/user";

/** SQLite stores UTC timestamps as "YYYY-MM-DD HH:MM:SS" without zone. */
function formatSqliteTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "–";
  }
  const utcDate = new Date(`${timestamp.replace(" ", "T")}Z`);
  return utcDate.toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function UserAdministrationPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, isLoading } = useAuth();
  const [users, setUsers] = useState<UserAdministrationEntry[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get<{ users: UserAdministrationEntry[] }>(
        "/api/admin/users"
      );
      setUsers(data.users);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Nutzer konnten nicht geladen werden"
      );
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!user) {
      router.push("/login?redirect=/admin/users");
    } else if (!user.is_admin) {
      router.push("/dashboard");
    } else {
      fetchUsers();
    }
  }, [isLoading, user, router, fetchUsers]);

  async function handleUnlock(userToUnlock: UserAdministrationEntry) {
    setUnlockingUserId(userToUnlock.id);
    try {
      const { user: unlockedUser } = await api.post<{ user: UserAdministrationEntry }>(
        `/api/admin/users/${userToUnlock.id}/unlock`
      );
      setUsers((current) =>
        current.map((entry) => (entry.id === unlockedUser.id ? unlockedUser : entry))
      );
      toast.success(`${unlockedUser.username} wurde entsperrt`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Entsperren fehlgeschlagen");
    } finally {
      setUnlockingUserId(null);
    }
  }

  if (isLoading || !user?.is_admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-500">Laden...</div>
      </div>
    );
  }

  const lockedUserCount = users.filter((entry) => entry.is_locked).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header title="Nutzerverwaltung" backHref="/dashboard" backLabel="Übersicht" />

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl dark:text-zinc-50">
            Registrierte Nutzer
          </h2>
          {!isLoadingUsers && !loadError && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {users.length} Nutzer · {lockedUserCount} gesperrt
            </p>
          )}
        </div>

        {isLoadingUsers ? (
          <div className="text-zinc-500">Laden...</div>
        ) : loadError ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {loadError}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Benutzername</th>
                  <th className="px-4 py-3 font-medium">Anzeigename</th>
                  <th className="px-4 py-3 font-medium">Registriert</th>
                  <th className="px-4 py-3 font-medium">Letzte Anmeldung</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {users.map((entry) => (
                  <UserRow
                    key={entry.id}
                    entry={entry}
                    isUnlocking={unlockingUserId === entry.id}
                    onUnlock={() => handleUnlock(entry)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

interface UserRowProps {
  entry: UserAdministrationEntry;
  isUnlocking: boolean;
  onUnlock: () => void;
}

function UserRow({ entry, isUnlocking, onUnlock }: UserRowProps) {
  return (
    <tr className="text-zinc-700 dark:text-zinc-300">
      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
        {entry.username}
        {entry.is_admin && (
          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Admin
          </span>
        )}
      </td>
      <td className="px-4 py-3">{entry.display_name || "–"}</td>
      <td className="px-4 py-3 whitespace-nowrap">{formatSqliteTimestamp(entry.created_at)}</td>
      <td className="px-4 py-3 whitespace-nowrap">{formatSqliteTimestamp(entry.last_login_at)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        {entry.is_locked ? (
          <span
            className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400"
            title={`Gesperrt bis ${formatSqliteTimestamp(entry.locked_until)}`}
          >
            Gesperrt bis {formatSqliteTimestamp(entry.locked_until)}
          </span>
        ) : (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-400">
            Aktiv
          </span>
        )}
        {!entry.is_locked && entry.failed_login_attempts > 0 && (
          <span className="ml-2 text-xs text-zinc-400">
            {entry.failed_login_attempts} Fehlversuch(e)
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {(entry.is_locked || entry.failed_login_attempts > 0) && (
          <button
            onClick={onUnlock}
            disabled={isUnlocking}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isUnlocking ? "Entsperren..." : "Entsperren"}
          </button>
        )}
      </td>
    </tr>
  );
}
