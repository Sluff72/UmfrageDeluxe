"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useParticipantToken } from "@/hooks/useParticipantToken";
import { useSurveySocket } from "@/hooks/useSurveySocket";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import { useToast } from "@/components/Toast";
import PhaseController from "@/components/PhaseController";
import OptionsList from "@/components/OptionsList";
import VotingPanel from "@/components/VotingPanel";
import ResultsPanel from "@/components/ResultsPanel";
import ParticipantsList from "@/components/ParticipantsList";
import ConfirmDialog from "@/components/ConfirmDialog";
import VotingMethodEditor from "@/components/VotingMethodEditor";
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
  const toast = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showVotingMethodEditor, setShowVotingMethodEditor] = useState(false);

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
    onOptionsReordered: () => {
      setOptionsRevision((r) => r + 1);
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
    onSurveyUpdated: (payload) => {
      // Voting-method/settings change by host/co-host – sync local state
      setSurvey(payload.survey);
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
    setShowDeleteConfirm(false);
    try {
      await api.delete(`/api/surveys/${surveyId}`);
      router.push("/dashboard");
    } catch {
      setError("Umfrage konnte nicht gelöscht werden");
    }
  }

  async function handleDuplicate() {
    setIsDuplicating(true);
    try {
      const data = await api.post<{ survey: Survey }>(
        `/api/surveys/${surveyId}/duplicate`
      );
      toast.success("Umfrage dupliziert");
      router.push(`/survey/${data.survey.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Duplizieren fehlgeschlagen"
      );
      setIsDuplicating(false);
    }
  }

  async function handleArchive() {
    setShowArchiveConfirm(false);
    try {
      await api.post(`/api/surveys/${surveyId}/archive`);
      toast.success("Umfrage archiviert");
      fetchSurvey();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Archivierung fehlgeschlagen"
      );
    }
  }

  function copyInviteLink() {
    if (!survey) return;
    const link = `${window.location.origin}/join/${survey.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Einladungslink kopiert!");
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
      <Header
        title={survey.title}
        backHref={backHref}
        backLabel={user ? "Zurück" : "Startseite"}
        rightContent={
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              SURVEY_STATUS_COLORS[survey.status]
            }`}
          >
            {SURVEY_STATUS_LABELS[survey.status]}
          </span>
        }
      />

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content area */}
          <div className="space-y-6 lg:col-span-2">
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

            {/* Options list – visible from optionen_sammeln onward.
                Hidden for participants during abstimmen: option titles/descriptions
                are already shown above each slider in the VotingPanel.
                Host/Co-Host still see the list in parallel for oversight. */}
            {survey.status !== "entwurf" &&
              (survey.status !== "abstimmen" || canManage) && (
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
                  anonymousVoting={survey.anonymous_voting === 1}
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
                anonymousVoting={survey.anonymous_voting === 1}
                onObjectionChange={refreshTransitionInfo}
                revision={votesRevision + objectionsRevision}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Survey info */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Details
                </h3>
                {canManage &&
                  (survey.status === "entwurf" ||
                    survey.status === "optionen_sammeln") && (
                    <button
                      type="button"
                      onClick={() => setShowVotingMethodEditor(true)}
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Ändern
                    </button>
                  )}
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-zinc-400 dark:text-zinc-500">Methode</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {VOTING_METHOD_LABELS[survey.voting_method]}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400 dark:text-zinc-500">
                    Abstimmung
                  </dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {survey.anonymous_voting === 1 ? "Anonym" : "Namentlich"}
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
            {canManage && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Aktionen
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={handleDuplicate}
                    disabled={isDuplicating}
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {isDuplicating ? "Dupliziere..." : "Umfrage duplizieren"}
                  </button>
                  {isHost && survey.status === "beendet" && !survey.is_archived && (
                    <button
                      onClick={() => setShowArchiveConfirm(true)}
                      className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Umfrage archivieren
                    </button>
                  )}
                  {isHost && survey.is_archived === 1 && (
                    <div className="rounded-lg bg-zinc-100 px-4 py-2 text-center text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Archiviert
                    </div>
                  )}
                  {isHost && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Umfrage l&ouml;schen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete survey confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Umfrage löschen"
        message="Möchtest du diese Umfrage wirklich löschen? Alle Optionen, Abstimmungen und Einwände werden unwiderruflich entfernt."
        confirmLabel="Endgültig löschen"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Archive survey confirmation */}
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Umfrage archivieren"
        message="Die Umfrage wird archiviert und im Dashboard unter 'Archiviert' angezeigt. Du kannst sie dort weiterhin einsehen."
        confirmLabel="Archivieren"
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      {/* Voting method editor (host/co-host in entwurf or optionen_sammeln) */}
      <VotingMethodEditor
        open={showVotingMethodEditor}
        survey={survey}
        onClose={() => setShowVotingMethodEditor(false)}
        onUpdated={(updated) => setSurvey(updated)}
      />
    </div>
  );
}
