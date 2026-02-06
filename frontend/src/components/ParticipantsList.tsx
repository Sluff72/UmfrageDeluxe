"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { SurveyParticipant, SurveyRole } from "@/types/survey";

interface ParticipantsListProps {
  surveyId: string;
  participants: SurveyParticipant[];
  currentParticipantId: string | null;
  isHost: boolean;
  onParticipantsChange: () => void;
}

const ROLE_LABELS: Record<SurveyRole, string> = {
  host: "Host",
  co_host: "Co-Host",
  teilnehmer: "Teilnehmer",
};

const ROLE_COLORS: Record<SurveyRole, string> = {
  host: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  co_host:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  teilnehmer:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function ParticipantsList({
  surveyId,
  participants,
  currentParticipantId,
  isHost,
  onParticipantsChange,
}: ParticipantsListProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function handleRoleChange(
    participantId: string,
    newRole: "co_host" | "teilnehmer"
  ) {
    setUpdatingId(participantId);
    setError(null);

    try {
      await api.put(
        `/api/surveys/${surveyId}/participants/${participantId}/role`,
        { role: newRole }
      );
      toast.success(
        newRole === "co_host"
          ? "Zum Co-Host befördert"
          : "Zum Teilnehmer zurückgestuft"
      );
      onParticipantsChange();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Rolle konnte nicht geändert werden"
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // Backend already sorts by role (host → co_host → teilnehmer), then joined_at
  const sortedParticipants = participants;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Teilnehmer ({participants.length})
      </h3>

      {error && (
        <p className="mb-3 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      <ul className="space-y-2">
        {sortedParticipants.map((p) => {
          const isCurrentUser = p.id === currentParticipantId;
          const isUpdating = updatingId === p.id;
          const isRegisteredUser = !!p.user_id;
          // Only registered users can be promoted to co-host (they need JWT for requireAuth endpoints).
          // Demoting an existing co-host back to teilnehmer is always allowed.
          const canPromote = isHost && p.role === "teilnehmer" && isRegisteredUser && !isCurrentUser;
          const canDemote = isHost && p.role === "co_host" && !isCurrentUser;
          const canChangeRole = canPromote || canDemote;

          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                  {p.display_name}
                  {isCurrentUser && (
                    <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">
                      (du)
                    </span>
                  )}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Role badge */}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[p.role]}`}
                >
                  {ROLE_LABELS[p.role]}
                </span>

                {/* Role toggle button (host only, not for host role) */}
                {canChangeRole && (
                  <button
                    onClick={() =>
                      handleRoleChange(
                        p.id,
                        p.role === "co_host" ? "teilnehmer" : "co_host"
                      )
                    }
                    disabled={isUpdating}
                    className="rounded px-2 py-0.5 text-xs text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    title={
                      p.role === "co_host"
                        ? "Zum Teilnehmer zurückstufen"
                        : "Zum Co-Host befördern"
                    }
                  >
                    {isUpdating
                      ? "…"
                      : p.role === "co_host"
                        ? "Zurückstufen"
                        : "Co-Host"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
