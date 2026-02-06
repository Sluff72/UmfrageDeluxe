"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useParticipantToken } from "@/hooks/useParticipantToken";
import { useSurveySocket } from "@/hooks/useSurveySocket";
import { api } from "@/lib/api";
import PhaseController from "@/components/PhaseController";
import OptionsList from "@/components/OptionsList";
import VotingPanel from "@/components/VotingPanel";
import ResultsPanel from "@/components/ResultsPanel";
import ParticipantsList from "@/components/ParticipantsList";
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
  const { getToken } = useParticipantToken(surveyId);

  // Revision counters – bumped by socket events to trigger child re-fetches
  const [optionsRevision, setOptionsRevision] = useState(0);
  const [votesRevision, setVotesRevision] = useState(0);
  const [objectionsRevision, setObjectionsRevision] = useState(0);

  // Set the API client's survey context so anonymous tokens are sent with requests
  useEffect(() => {
    api.setSurveyContext(surveyId);
    return () => {
      api.setSurveyContext(null);
    };
  }, [surveyId]);

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

  const refreshTransitionInfo = useCallback(async () => {
    try {
      const data = await api
        .get<TransitionInfo>(`/api/surveys/${surveyId}/transition-info`)
        .catch(() => null);
      setTransitionInfo(data);
    } catch {
      // ignore
    }
  }, [surveyId]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchSurvey();
    }
  }, [isAuthLoading, fetchSurvey]);

  // Socket.IO: real-time updates from other participants
  useSurveySocket(surveyId, {
    onPhaseChanged: () => {
      // Phase changed by another user (e.g. host) – re-fetch everything
      fetchSurvey();
    },
    onParticipantJoined: () => {
      // New participant joined – re-fetch to update participant count
      fetchSurvey();
    },
    onOptionAdded: () => {
      setOptionsRevision((r) => r + 1);
      refreshTransitionInfo();
    },
    onOptionUpdated: () => {
      setOptionsRevision((r) => r + 1);
    },
    onOptionRemoved: () => {
      setOptionsRevision((r) => r + 1);
      refreshTransitionInfo();
    },
    onVoteReceived: () => {
      setVotesRevision((r) => r + 1);
      refreshTransitionInfo();
    },
    onObjectionAdded: () => {
      setObjectionsRevision((r) => r + 1);
      refreshTransitionInfo();
    },
    onObjectionStatusChanged: () => {
      setObjectionsRevision((r) => r + 1);
      refreshTransitionInfo();
    },
    onParticipantRoleChanged: () => {
      // Role changed (promote/demote) – re-fetch to update participants list and permissions
      fetchSurvey();
    },
  });

  // Determine the current participant – either by user_id (registered) or by anonymous token
  const currentUserParticipant = useMemo(() => {
    // Registered user: match by user_id
    if (user) {
      return participants.find((p) => p.user_id === user.id) ?? null;
    }
    // Anonymous user: match by participant_id from stored token
    const tokenEntry = getToken();
    if (tokenEntry) {
      return participants.find((p) => p.id === tokenEntry.participantId) ?? null;
    }
    return null;
  }, [user, participants, getToken]);

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

  const backHref = user ? "/dashboard" : "/";

  if (error || !survey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-red-500">{error || "Umfrage nicht gefunden"}</p>
          <Link
            href={backHref}
            className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {user ? "Zurück zum Dashboard" : "Zur Startseite"}
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
            href={backHref}
            className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            &larr; {user ? "Zurück" : "Startseite"}
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
            {survey.status === "entwurf" && (
              <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-zinc-500 dark:text-zinc-400">
                  Die Umfrage befindet sich im Entwurf. Konfiguriere die
                  Einstellungen und starte die Optionensammlung.
                </p>
              </div>
            )}

            {/* Options list – visible from optionen_sammeln onward */}
            {survey.status !== "entwurf" && (
              <OptionsList
                surveyId={surveyId}
                surveyStatus={survey.status}
                currentParticipantId={currentUserParticipant?.id ?? null}
                canManage={canManage}
                onOptionsChange={refreshTransitionInfo}
                revision={optionsRevision}
              />
            )}

            {/* Voting panel – visible during abstimmen */}
            {survey.status === "abstimmen" && (
              <>
                {transitionInfo && transitionInfo.votingRound > 1 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                    Runde {transitionInfo.votingRound}
                  </div>
                )}
                <VotingPanel
                  surveyId={surveyId}
                  votingMethod={survey.voting_method}
                  wMax={survey.w_max}
                  maxPointsPerOption={survey.max_points_per_option}
                  onVoteSubmit={refreshTransitionInfo}
                />
              </>
            )}
            {/* Results – visible from einwand_integration onward, and for host during abstimmen */}
            {(survey.status === "einwand_integration" ||
              survey.status === "beendet" ||
              (survey.status === "abstimmen" && canManage)) && (
              <ResultsPanel
                key={survey.status}
                surveyId={surveyId}
                votingMethod={survey.voting_method}
                surveyStatus={survey.status}
                canManage={canManage}
                onObjectionChange={refreshTransitionInfo}
                revision={votesRevision + objectionsRevision}
              />
            )}
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
                {survey.voting_method === "widerstand_punkte" &&
                  survey.w_max !== null && (
                    <div>
                      <dt className="text-zinc-400 dark:text-zinc-500">
                        Punktebudget (W-Max)
                      </dt>
                      <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                        {survey.w_max} (= {survey.w_max / 5} Optionen &times; 5)
                      </dd>
                    </div>
                  )}
              </dl>
            </div>

            {/* Participants list with role management */}
            <ParticipantsList
              surveyId={surveyId}
              participants={participants}
              currentParticipantId={currentUserParticipant?.id ?? null}
              isHost={isHost}
              onParticipantsChange={fetchSurvey}
            />

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
