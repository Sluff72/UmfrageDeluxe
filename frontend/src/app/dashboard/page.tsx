"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import EmptyState from "@/components/EmptyState";
import ImportSurveysDialog from "@/components/ImportSurveysDialog";
import { SurveyCardSkeleton } from "@/components/Skeleton";
import type { SurveyWithParticipantCount } from "@/types/survey";
import {
  SURVEY_STATUS_LABELS,
  SURVEY_STATUS_COLORS,
  VOTING_METHOD_LABELS,
} from "@/types/survey";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [surveys, setSurveys] = useState<SurveyWithParticipantCount[]>([]);
  const [isLoadingSurveys, setIsLoadingSurveys] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const fetchSurveys = useCallback(async () => {
    try {
      const data = await api.get<{ surveys: SurveyWithParticipantCount[] }>(
        "/api/surveys"
      );
      setSurveys(data.surveys);
    } catch {
      // silently fail on fetch error
    } finally {
      setIsLoadingSurveys(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSurveys();
    }
  }, [isAuthenticated, fetchSurveys]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-500">Laden...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const activeSurveys = surveys.filter((s) => !s.is_archived);
  const archivedSurveys = surveys.filter((s) => s.is_archived);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header
        title="UmfrageDeluxe"
        rightContent={
          <>
            <span className="hidden text-sm text-zinc-600 sm:inline dark:text-zinc-400">
              {user.display_name || user.username}
            </span>
            {user.is_admin && (
              <Link
                href="/admin/users"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Nutzerverwaltung
              </Link>
            )}
            <button
              onClick={logout}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Abmelden
            </button>
          </>
        }
      />

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl dark:text-zinc-50">
            Meine Umfragen
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImportOpen(true)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Importieren
            </button>
            <Link
              href="/survey/new"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Neue Umfrage
            </Link>
          </div>
        </div>

        {isLoadingSurveys ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <SurveyCardSkeleton key={i} />
            ))}
          </div>
        ) : activeSurveys.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <EmptyState
              icon="📋"
              title="Noch keine Umfragen"
              description="Erstelle deine erste Umfrage und lade Teilnehmer ein."
              actionLabel="Neue Umfrage erstellen"
              actionHref="/survey/new"
            />
          </div>
        ) : (
          <div className="grid gap-4">
            {activeSurveys.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        )}

        {archivedSurveys.length > 0 && (
          <div className="mt-12">
            <h3 className="mb-4 text-lg font-semibold text-zinc-600 dark:text-zinc-400">
              Archiviert
            </h3>
            <div className="grid gap-4 opacity-70">
              {archivedSurveys.map((survey) => (
                <SurveyCard key={survey.id} survey={survey} />
              ))}
            </div>
          </div>
        )}
      </main>

      <ImportSurveysDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={fetchSurveys}
      />
    </div>
  );
}

function SurveyCard({ survey }: { survey: SurveyWithParticipantCount }) {
  return (
    <Link
      href={`/survey/${survey.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {survey.title}
          </h3>
          {survey.description && (
            <p className="mt-1 text-sm text-zinc-500 line-clamp-2 dark:text-zinc-400">
              {survey.description}
            </p>
          )}
        </div>
        <span
          className={`ml-4 shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            SURVEY_STATUS_COLORS[survey.status]
          }`}
        >
          {SURVEY_STATUS_LABELS[survey.status]}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 sm:mt-4 sm:gap-x-4 dark:text-zinc-500">
        <span>{VOTING_METHOD_LABELS[survey.voting_method]}</span>
        <span className="hidden sm:inline">&middot;</span>
        <span>{survey.participant_count} Teilnehmer</span>
        <span className="hidden sm:inline">&middot;</span>
        <span>Code: {survey.invite_code}</span>
      </div>
    </Link>
  );
}
