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
import type { VotingMethod } from "@/types/survey";

interface VoteResult {
  option_id: string;
  option_title: string;
  total_value: number;
  vote_count: number;
  average_value: number;
}

interface ResultsPanelProps {
  surveyId: string;
  votingMethod: VotingMethod;
}

export default function ResultsPanel({
  surveyId,
  votingMethod,
}: ResultsPanelProps) {
  const [results, setResults] = useState<VoteResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isResistance =
    votingMethod === "widerstand_punkte" || votingMethod === "widerstand";

  const fetchResults = useCallback(async () => {
    try {
      const data = await api.get<{ results: VoteResult[] }>(
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
  }, [fetchResults]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">Ergebnisse laden...</p>
      </div>
    );
  }

  if (error) {
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

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Ergebnisse
      </h2>

      {isResistance ? (
        <ResistanceResults results={results} />
      ) : (
        <MehrheitResults results={results} />
      )}
    </div>
  );
}

/* ── Resistance Results ────────────────────────────────────────── */

function ResistanceResults({ results }: { results: VoteResult[] }) {
  // Results are already sorted by average_value ASC (lowest resistance = best)
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
    <div className="space-y-6">
      {/* Chart */}
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
                <Cell
                  key={index}
                  fill={getResistanceColor(entry.average)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ranking table */}
      <div className="space-y-2">
        {results.map((r, i) => (
          <div
            key={r.option_id}
            className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i === 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
              }`}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {r.option_title}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`text-lg font-bold ${getResistanceTextColor(r.average_value)}`}
              >
                {r.average_value.toFixed(1)}
              </span>
              <span className="ml-1 text-xs text-zinc-400">/ 10</span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
        Niedrigerer Widerstand = besserer Konsens. Sortiert vom geringsten zum
        höchsten Widerstand.
      </p>
    </div>
  );
}

/* ── Mehrheit Results ──────────────────────────────────────────── */

function MehrheitResults({ results }: { results: VoteResult[] }) {
  // For mehrheit: value=1 means approve, value=0 means reject
  // total_value = number of approvals, vote_count = total votes
  const chartData = results.map((r) => ({
    name:
      r.option_title.length > 25
        ? r.option_title.slice(0, 25) + "…"
        : r.option_title,
    fullName: r.option_title,
    approvals: r.total_value,
    rejections: r.vote_count - r.total_value,
    total: r.vote_count,
    percentage: r.vote_count > 0 ? (r.total_value / r.vote_count) * 100 : 0,
  }));

  // Sort by approval percentage DESC
  const sorted = [...chartData].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div style={{ height: Math.max(results.length * 50, 120) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
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

      {/* Ranking table */}
      <div className="space-y-2">
        {sorted.map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i === 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
              }`}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {r.fullName}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {r.approvals}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <span className="font-medium text-red-500 dark:text-red-400">
                {r.rejections}
              </span>
              <span className="ml-1 text-xs text-zinc-400">
                ({r.percentage.toFixed(0)}%)
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
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
    </div>
  );
}

/* ── Color helpers ─────────────────────────────────────────────── */

function getResistanceColor(value: number): string {
  // Green (0) → Yellow (5) → Red (10)
  if (value <= 2) return "#10b981"; // emerald-500
  if (value <= 4) return "#84cc16"; // lime-500
  if (value <= 6) return "#eab308"; // yellow-500
  if (value <= 8) return "#f97316"; // orange-500
  return "#ef4444"; // red-500
}

function getResistanceTextColor(value: number): string {
  if (value <= 3) return "text-emerald-600 dark:text-emerald-400";
  if (value <= 6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
