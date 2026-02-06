"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import PhaseController from "@/components/PhaseController";
import type { Survey, SurveyParticipant, TransitionInfo } from "@/types/survey";
import {
  SURVEY_STATUS_LABELS,
  SURVEY_STATUS_COLORS,
  VOTING_METHOD_LABELS,
} from "@/types/survey";

export default function SurveyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [participants, setParticipants] = useState<SurveyParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitionInfo, setTransitionInfo] = useState<TransitionInfo | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const surveyId = params.surveyId as string;

  const fetchSurvey = useCallback(async () => {
    try {
      const [surveyData, transitionData] = await Promise.all([
        api.get<{
          survey: Survey;
          participants: SurveyParticipant[];
        }>(`/api/surveys/${surveyId}`),
        api
          .get<TransitionInfo>(`/api/surveys/${surveyId}/transition-info`)
          .catch(() => null),
      ]);
      setSurvey(surveyData.survey);
      setParticipants(surveyData.participants);
      setTransitionInfo(transitionData);
    } catch {
      setError("Umfrage konnte nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchSurvey();
    }
  }, [isAuthLoading, fetchSurvey]);

  const currentUserParticipant = participants.find(
    (p) => p.user_id === user?.id
  );
  const isHost = currentUserParticipant?.role === "host";
  const isCoHost = currentUserParticipant?.role === "co_host";
  const canManage = isHost || isCoHost;

  async function handleDelete() {
    if (!confirm("Möchtest du diese Umfrage wirklich löschen?")) return;
    try {
      await api.delete(`/api/surveys/${surveyId}`);
      router.push("/dashboard");
    } catch {
      setError("Umfrage konnte nicht gelöscht werden");
    }
  }

  function copyInviteLink() {
    if (!survey) return;
    const link = `${window.location.origin}/join/${survey.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-500">Laden...</div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-red-500">{error || "Umfrage nicht gefunden"}</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Zurück zum Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            &larr; Zurück
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {survey.title}
            </h1>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              SURVEY_STATUS_COLORS[survey.status]
            }`}
          >
            {SURVEY_STATUS_LABELS[survey.status]}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main content area */}
          <div className="md:col-span-2 space-y-6">
            {survey.description && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Beschreibung
                </h2>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {survey.description}
                </p>
              </div>
            )}

            {/* Phase-dependent content area */}
            <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
              {survey.status === "entwurf" && (
                <div className="text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Die Umfrage befindet sich im Entwurf. Konfiguriere die
                    Einstellungen und starte die Optionensammlung.
                  </p>
                </div>
              )}
              {survey.status === "optionen_sammeln" && (
                <div className="text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Teilnehmer können jetzt Optionen einreichen.
                  </p>
                </div>
              )}
              {survey.status === "abstimmen" && (
                <div className="text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Die Abstimmung läuft.
                    {transitionInfo && transitionInfo.votingRound > 1 && (
                      <span className="block mt-1 text-xs">
                        Runde {transitionInfo.votingRound}
                      </span>
                    )}
                  </p>
                </div>
              )}
              {survey.status === "einwand_integration" && (
                <div className="text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Einwände können eingereicht und integriert werden.
                  </p>
                </div>
              )}
              {survey.status === "beendet" && (
                <div className="text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Die Umfrage ist beendet. Die Ergebnisse stehen fest.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Survey info */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Details
              </h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-zinc-400 dark:text-zinc-500">Methode</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {VOTING_METHOD_LABELS[survey.voting_method]}
                  </dd>
                </div>
                {survey.voting_method === "widerstand_punkte" && (
                  <>
                    <div>
                      <dt className="text-zinc-400 dark:text-zinc-500">
                        W-Max
                      </dt>
                      <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                        {survey.w_max ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400 dark:text-zinc-500">
                        Max/Option
                      </dt>
                      <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                        {survey.max_points_per_option}
                      </dd>
                    </div>
                  </>
                )}
                <div>
                  <dt className="text-zinc-400 dark:text-zinc-500">
                    Teilnehmer
                  </dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {participants.length}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Phase Controller */}
            {transitionInfo && (
              <PhaseController
                surveyId={surveyId}
                transitionInfo={transitionInfo}
                canManage={canManage}
                onTransitionComplete={fetchSurvey}
              />
            )}

            {/* Share */}
            {canManage && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Teilen
                </h3>
                <button
                  onClick={copyInviteLink}
                  className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {copied ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Link kopiert!
                    </span>
                  ) : (
                    <span className="text-zinc-700 dark:text-zinc-300">
                      Einladungslink kopieren
                    </span>
                  )}
                </button>
                <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  Code: {survey.invite_code}
                </p>
              </div>
            )}

            {/* Actions */}
            {isHost && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Aktionen
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={handleDelete}
                    className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Umfrage löschen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
