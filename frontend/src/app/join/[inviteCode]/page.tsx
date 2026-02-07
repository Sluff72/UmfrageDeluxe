"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { setParticipantTokenForSurvey } from "@/hooks/useParticipantToken";
import type { Survey } from "@/types/survey";

interface JoinResponse {
  survey: Survey;
  participant: {
    id: string;
    role: string;
    anonymousToken: string | null;
  };
}

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const inviteCode = params.inviteCode as string;

  const [displayName, setDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setIsJoining(true);
    setError(null);

    try {
      const body: { displayName?: string } = {};

      // Registered users don't need a display name (their username/display_name is used).
      // Anonymous users should provide a name so others can identify them.
      if (!user && displayName.trim()) {
        body.displayName = displayName.trim();
      }

      const data = await api.post<JoinResponse>(
        `/api/surveys/join/${inviteCode}`,
        body
      );

      // Store anonymous token if provided (anonymous users only)
      if (data.participant.anonymousToken) {
        setParticipantTokenForSurvey(
          data.survey.id,
          data.participant.anonymousToken,
          data.participant.id
        );
      }

      // Redirect to the survey page
      router.push(`/survey/${data.survey.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setError("Einladungslink ist ungültig oder die Umfrage existiert nicht.");
        } else if (err.statusCode === 403) {
          setError(err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError("Beitritt fehlgeschlagen. Bitte versuche es erneut.");
      }
    } finally {
      setIsJoining(false);
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Umfrage beitreten
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {user
                ? `Du trittst als ${user.display_name || user.username} bei.`
                : "Gib deinen Namen ein, um teilzunehmen."}
            </p>
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin}>
            {/* Name input – only for anonymous users */}
            {!user && (
              <div className="mb-6">
                <label
                  htmlFor="displayName"
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Dein Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="z.B. Max Mustermann"
                  autoFocus
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
                <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                  Dein Name wird den anderen Teilnehmern angezeigt.
                </p>
              </div>
            )}

            {/* Registered user info */}
            {user && (
              <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Eingeloggt als{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {user.display_name || user.username}
                  </span>
                </p>
              </div>
            )}

            {/* Invite code display */}
            <div className="mb-6 text-center">
              <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                Code: {inviteCode}
              </span>
            </div>

            {/* Join button */}
            <button
              type="submit"
              disabled={isJoining || (!user && !displayName.trim())}
              className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isJoining ? "Beitritt..." : "Umfrage beitreten"}
            </button>
          </form>

          {/* Footer link */}
          {!user && (
            <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
              Du hast bereits ein Konto?{" "}
              <Link
                href={`/login?redirect=/join/${inviteCode}`}
                className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
              >
                Einloggen
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
