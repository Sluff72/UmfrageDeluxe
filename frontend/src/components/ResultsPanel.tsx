"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import type { VotingMethod, SurveyStatus, ObjectionStatus } from "@/types/survey";

/* ── Types ─────────────────────────────────────────────────────── */

interface ObjectionWithAuthor {
  id: string;
  text: string;
  status: ObjectionStatus;
  host_response: string | null;
  author_name: string;
  created_at: string;
}

interface VoteResultWithObjections {
  option_id: string;
  option_title: string;
  total_value: number;
  vote_count: number;
  average_value: number;
  objections: ObjectionWithAuthor[];
}

interface ResultsPanelProps {
  surveyId: string;
  votingMethod: VotingMethod;
  surveyStatus: SurveyStatus;
  canManage: boolean;
  onObjectionChange?: () => void;
  /** Bumped externally (e.g. by socket events) to trigger a re-fetch */
  revision?: number;
}

const OBJECTION_STATUS_LABELS: Record<ObjectionStatus, string> = {
  pending: "Offen",
  integrated: "Integriert",
  dismissed: "Abgelehnt",
};

const OBJECTION_STATUS_COLORS: Record<ObjectionStatus, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  integrated:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  dismissed:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

/* ── Main Component ────────────────────────────────────────────── */

export default function ResultsPanel({
  surveyId,
  votingMethod,
  surveyStatus,
  canManage,
  onObjectionChange,
  revision = 0,
}: ResultsPanelProps) {
  const [results, setResults] = useState<VoteResultWithObjections[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Objection form state
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Review state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewResponse, setReviewResponse] = useState("");

  const isResistance =
    votingMethod === "widerstand_punkte" || votingMethod === "widerstand";
  const isObjectionPhase = surveyStatus === "einwand_integration";
  const showObjections = surveyStatus !== "beendet";

  const fetchResults = useCallback(async () => {
    try {
      const data = await api.get<{ results: VoteResultWithObjections[] }>(
        `/api/surveys/${surveyId}/results`
      );
      setResults(data.results);
    } catch {
      setError("Ergebnisse konnten nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults, revision]);

  function handleOptionClick(optionId: string) {
    if (!isObjectionPhase) return;
    if (activeOptionId === optionId) {
      setActiveOptionId(null);
      setNewText("");
    } else {
      setActiveOptionId(optionId);
      setNewText("");
    }
  }

  async function handleSubmitObjection(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim() || !activeOptionId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post(`/api/surveys/${surveyId}/objections`, {
        text: newText.trim(),
        optionId: activeOptionId,
      });
      setNewText("");
      setActiveOptionId(null);
      // Re-fetch results to include the new objection
      await fetchResults();
      onObjectionChange?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Einwand konnte nicht eingereicht werden"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReview(
    objectionId: string,
    status: "integrated" | "dismissed"
  ) {
    setError(null);
    try {
      await api.put(
        `/api/surveys/${surveyId}/objections/${objectionId}`,
        {
          status,
          hostResponse: reviewResponse.trim() || undefined,
        }
      );
      setReviewingId(null);
      setReviewResponse("");
      // Re-fetch to update status
      await fetchResults();
      onObjectionChange?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Einwand konnte nicht bearbeitet werden"
      );
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">Ergebnisse laden...</p>
      </div>
    );
  }

  if (error && results.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Ergebnisse
        </h2>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Noch keine Stimmen abgegeben.
        </p>
      </div>
    );
  }

  // Count objections across all options
  const allObjections = results.flatMap((r) => r.objections);
  const pendingCount = allObjections.filter(
    (o) => o.status === "pending"
  ).length;
  const integratedCount = allObjections.filter(
    (o) => o.status === "integrated"
  ).length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Ergebnisse
          {showObjections && allObjections.length > 0 && (
            <span className="ml-2 font-normal normal-case">
              · {allObjections.length}{" "}
              {allObjections.length === 1 ? "Einwand" : "Einwände"}
            </span>
          )}
        </h2>
        {showObjections && allObjections.length > 0 && (
          <div className="flex gap-2 text-xs">
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {pendingCount} offen
              </span>
            )}
            {integratedCount > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {integratedCount} integriert
              </span>
            )}
          </div>
        )}
      </div>

      {isObjectionPhase && (
        <p className="mb-4 text-sm text-zinc-400 dark:text-zinc-500">
          Klicke auf eine Option, um einen Einwand zu formulieren: Was brauchst
          du, um weniger Widerstand zu haben?
        </p>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Chart */}
      {isResistance ? (
        <ResistanceChart results={results} />
      ) : (
        <MehrheitChart results={results} />
      )}

      {/* Ranking with integrated objections */}
      <div className="mt-6 space-y-3">
        {(isResistance
          ? results
          : [...results].sort(
              (a, b) =>
                (b.vote_count > 0 ? b.total_value / b.vote_count : 0) -
                (a.vote_count > 0 ? a.total_value / a.vote_count : 0)
            )
        ).map((r, i) => (
          <div key={r.option_id}>
            {/* Option row */}
            <button
              type="button"
              onClick={() => handleOptionClick(r.option_id)}
              disabled={!isObjectionPhase}
              className={`w-full rounded-lg border p-4 text-left transition ${
                activeOptionId === r.option_id
                  ? "border-purple-400 bg-purple-50 ring-1 ring-purple-400 dark:border-purple-500 dark:bg-purple-900/20 dark:ring-purple-500"
                  : isObjectionPhase
                    ? "border-zinc-100 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
                    : "border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {r.option_title}
                  </p>
                </div>
                {/* Score */}
                {isResistance ? (
                  <div className="text-right">
                    <span
                      className={`text-lg font-bold ${getResistanceTextColor(r.average_value)}`}
                    >
                      {r.average_value.toFixed(1)}
                    </span>
                    <span className="ml-1 text-xs text-zinc-400">/ 10</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {r.total_value}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-600">/</span>
                    <span className="font-medium text-red-500 dark:text-red-400">
                      {r.vote_count - r.total_value}
                    </span>
                    <span className="ml-1 text-xs text-zinc-400">
                      (
                      {r.vote_count > 0
                        ? ((r.total_value / r.vote_count) * 100).toFixed(0)
                        : 0}
                      %)
                    </span>
                  </div>
                )}
                {/* Objection badge */}
                {showObjections && r.objections.length > 0 && (
                  <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {r.objections.length}
                  </span>
                )}
              </div>
            </button>

            {/* Objections for this option */}
            {showObjections && r.objections.length > 0 && (
              <div className="ml-4 mt-2 space-y-2 border-l-2 border-purple-200 pl-4 dark:border-purple-800">
                {r.objections.map((objection) => (
                  <div
                    key={objection.id}
                    className="rounded-md border border-zinc-100 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-zinc-900 dark:text-zinc-100">
                          {objection.text}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                          — {objection.author_name}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          OBJECTION_STATUS_COLORS[objection.status]
                        }`}
                      >
                        {OBJECTION_STATUS_LABELS[objection.status]}
                      </span>
                    </div>

                    {objection.host_response && (
                      <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Antwort:
                        </p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">
                          {objection.host_response}
                        </p>
                      </div>
                    )}

                    {/* Review controls (host/co-host, pending, einwand phase) */}
                    {canManage &&
                      objection.status === "pending" &&
                      isObjectionPhase && (
                        <div className="mt-2">
                          {reviewingId === objection.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={reviewResponse}
                                onChange={(e) =>
                                  setReviewResponse(e.target.value)
                                }
                                placeholder="Antwort / Begründung (optional)"
                                rows={2}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleReview(objection.id, "integrated")
                                  }
                                  className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                                >
                                  Integrieren
                                </button>
                                <button
                                  onClick={() =>
                                    handleReview(objection.id, "dismissed")
                                  }
                                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                >
                                  Ablehnen
                                </button>
                                <button
                                  onClick={() => {
                                    setReviewingId(null);
                                    setReviewResponse("");
                                  }}
                                  className="rounded-md px-3 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                >
                                  Abbrechen
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setReviewingId(objection.id)}
                              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Bearbeiten
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}

            {/* Inline objection form */}
            {activeOptionId === r.option_id && (
              <form
                onSubmit={handleSubmitObjection}
                className="ml-4 mt-2 border-l-2 border-purple-400 pl-4 dark:border-purple-500"
              >
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Was brauchst du, um bei diesem Punkt weniger Widerstand zu haben?"
                  rows={3}
                  autoFocus
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={!newText.trim() || isSubmitting}
                    className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting
                      ? "Wird eingereicht..."
                      : "Einwand einreichen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveOptionId(null);
                      setNewText("");
                    }}
                    className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4">
        {isResistance ? (
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
            Niedrigerer Widerstand = besserer Konsens. Sortiert vom geringsten
            zum höchsten Widerstand.
          </p>
        ) : (
          <div className="flex justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Zustimmung
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
              Ablehnung
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Charts ────────────────────────────────────────────────────── */

function ResistanceChart({
  results,
}: {
  results: VoteResultWithObjections[];
}) {
  const chartData = results.map((r) => ({
    name:
      r.option_title.length > 25
        ? r.option_title.slice(0, 25) + "…"
        : r.option_title,
    fullName: r.option_title,
    average: r.average_value,
    total: r.total_value,
    votes: r.vote_count,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {d.fullName}
                  </p>
                  <p className="text-zinc-500">
                    Durchschnitt: {d.average.toFixed(1)}
                  </p>
                  <p className="text-zinc-500">
                    Gesamt: {d.total} ({d.votes}{" "}
                    {d.votes === 1 ? "Stimme" : "Stimmen"})
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="average" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={getResistanceColor(entry.average)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MehrheitChart({
  results,
}: {
  results: VoteResultWithObjections[];
}) {
  const chartData = [...results]
    .map((r) => ({
      name:
        r.option_title.length > 25
          ? r.option_title.slice(0, 25) + "…"
          : r.option_title,
      fullName: r.option_title,
      approvals: r.total_value,
      rejections: r.vote_count - r.total_value,
      total: r.vote_count,
      percentage:
        r.vote_count > 0 ? (r.total_value / r.vote_count) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return (
    <div style={{ height: Math.max(results.length * 50, 120) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
        >
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {d.fullName}
                  </p>
                  <p className="text-emerald-600">
                    Zustimmung: {d.approvals}
                  </p>
                  <p className="text-red-500">Ablehnung: {d.rejections}</p>
                  <p className="text-zinc-500">
                    {d.percentage.toFixed(0)}% Zustimmung
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="approvals"
            stackId="votes"
            fill="#10b981"
            radius={[0, 0, 0, 0]}
            maxBarSize={28}
            name="Zustimmung"
          />
          <Bar
            dataKey="rejections"
            stackId="votes"
            fill="#ef4444"
            radius={[0, 4, 4, 0]}
            maxBarSize={28}
            name="Ablehnung"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Color helpers ─────────────────────────────────────────────── */

function getResistanceColor(value: number): string {
  if (value <= 2) return "#10b981";
  if (value <= 4) return "#84cc16";
  if (value <= 6) return "#eab308";
  if (value <= 8) return "#f97316";
  return "#ef4444";
}

function getResistanceTextColor(value: number): string {
  if (value <= 3) return "text-emerald-600 dark:text-emerald-400";
  if (value <= 6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
