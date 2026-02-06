"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { VotingPanelSkeleton } from "@/components/Skeleton";
import type { SurveyOption, VotingMethod } from "@/types/survey";

interface VoteEntry {
  optionId: string;
  value: number;
}

interface VoteFromServer {
  id: string;
  option_id: string;
  value: number;
}

interface VotingPanelProps {
  surveyId: string;
  votingMethod: VotingMethod;
  wMax: number | null;
  maxPointsPerOption: number | null;
  onVoteSubmit?: () => void;
}

export default function VotingPanel({
  surveyId,
  votingMethod,
  wMax,
  maxPointsPerOption,
  onVoteSubmit,
}: VotingPanelProps) {
  const [options, setOptions] = useState<SurveyOption[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const effectiveMaxPerOption = maxPointsPerOption ?? 10;
  const isResistance =
    votingMethod === "widerstand_punkte" || votingMethod === "widerstand";

  // Fetch options + existing votes
  const fetchData = useCallback(async () => {
    try {
      const [optionsData, votesData] = await Promise.all([
        api.get<{ options: SurveyOption[] }>(`/api/surveys/${surveyId}/options`),
        api
          .get<{ votes: VoteFromServer[] }>(`/api/surveys/${surveyId}/votes/mine`)
          .catch(() => ({ votes: [] as VoteFromServer[] })),
      ]);

      const fetchedOptions = optionsData.options;
      setOptions(fetchedOptions);

      // Initialize votes
      const initial: Record<string, number> = {};
      for (const option of fetchedOptions) {
        initial[option.id] = 0;
      }

      if (votesData.votes.length > 0) {
        setHasVoted(true);
        for (const v of votesData.votes) {
          initial[v.option_id] = v.value;
        }
      }

      setVotes(initial);
    } catch {
      setError("Abstimmungsdaten konnten nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function setVoteValue(optionId: string, value: number) {
    setVotes((prev) => ({ ...prev, [optionId]: value }));
    setError(null);
  }

  function getTotalPoints(): number {
    return Object.values(votes).reduce((sum, v) => sum + v, 0);
  }

  function getRemainingPoints(): number {
    if (wMax === null) return Infinity;
    return wMax - getTotalPoints();
  }

  /** Dynamic max for a slider: allows up to 10 per option, capped by remaining budget */
  function getMaxForOption(optionId: string): number {
    if (votingMethod !== "widerstand_punkte" || wMax === null) {
      return effectiveMaxPerOption;
    }
    const currentValue = votes[optionId] ?? 0;
    // Sum all OTHER slider values (not this one)
    const otherTotal = Object.entries(votes)
      .filter(([id]) => id !== optionId)
      .reduce((sum, [, v]) => sum + v, 0);
    const budgetLeft = wMax - otherTotal;
    return Math.min(effectiveMaxPerOption, Math.max(0, budgetLeft));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    const voteEntries: VoteEntry[] = options.map((option) => ({
      optionId: option.id,
      value: Math.min(votes[option.id] ?? 0, getMaxForOption(option.id)),
    }));

    try {
      await api.post(`/api/surveys/${surveyId}/votes`, { votes: voteEntries });
      setHasVoted(true);
      toast.success("Abstimmung erfolgreich gespeichert!");
      onVoteSubmit?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Abstimmung konnte nicht gespeichert werden"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <VotingPanelSkeleton />;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {isResistance ? "Widerstandsabfrage" : "Abstimmung"}
        </h2>
        {hasVoted && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Abgestimmt
          </span>
        )}
      </div>

      {/* Budget indicator for widerstand_punkte */}
      {votingMethod === "widerstand_punkte" && wMax !== null && (
        <PointBudget
          total={wMax}
          used={getTotalPoints()}
          remaining={getRemainingPoints()}
        />
      )}

      {error && (
        <p className="mb-4 text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Voting inputs per option */}
      <div className="space-y-4">
        {options.map((option) => (
          <div
            key={option.id}
            className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <div className="mb-2">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {option.title}
              </p>
              {option.description && (
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  {option.description}
                </p>
              )}
            </div>

            {isResistance ? (
              <ResistanceSlider
                value={votes[option.id] ?? 0}
                max={getMaxForOption(option.id)}
                onChange={(v) => setVoteValue(option.id, v)}
              />
            ) : (
              <MehrheitButtons
                value={votes[option.id] ?? 0}
                onChange={(v) => setVoteValue(option.id, v)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || getRemainingPoints() < 0}
        className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Wird gespeichert..."
          : hasVoted
            ? "Abstimmung aktualisieren"
            : "Abstimmen"}
      </button>
    </div>
  );
}

/* ── Resistance Slider ─────────────────────────────────────────── */

function ResistanceSlider({
  value: rawValue,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  // Clamp displayed value to current max (budget may have shrunk)
  const value = Math.min(rawValue, max);

  // Green (0) → Yellow (5) → Red (10)
  const percentage = max > 0 ? (value / 10) * 100 : 0;

  function getColor(pct: number): string {
    if (pct <= 30) return "text-emerald-600 dark:text-emerald-400";
    if (pct <= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }

  function getTrackGradient(): string {
    return "bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
        <span>Kein Widerstand</span>
        <span className={`text-lg font-bold ${getColor(percentage)}`}>
          {value}
        </span>
        <span>Hoher Widerstand</span>
      </div>

      {/* Slider track */}
      <div className="relative">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className={`h-full rounded-full transition-all ${getTrackGradient()}`}
            style={{ width: `${(value / 10) * 100}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={10}
          value={value}
          onChange={(e) => onChange(Math.min(Number(e.target.value), max))}
          className="absolute inset-0 h-2 w-full cursor-pointer appearance-none bg-transparent
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-zinc-600
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
            [&::-webkit-slider-thumb]:bg-zinc-600 [&::-webkit-slider-thumb]:shadow"
        />
      </div>

      {/* Step markers */}
      <div className="flex justify-between px-0.5">
        {Array.from({ length: 11 }, (_, i) => {
          const withinBudget = i <= max;
          return (
            <button
              key={i}
              onClick={() => withinBudget && onChange(i)}
              className={`h-1.5 w-1.5 rounded-full transition ${
                !withinBudget
                  ? "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800"
                  : i <= value
                    ? "bg-zinc-400 dark:bg-zinc-500"
                    : "bg-zinc-200 dark:bg-zinc-700"
              }`}
              title={withinBudget ? `${i}` : `${i} (Budget)`}
              disabled={!withinBudget}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Mehrheit Buttons ──────────────────────────────────────────── */

function MehrheitButtons({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange(1)}
        className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
          value === 1
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        Zustimmen
      </button>
      <button
        onClick={() => onChange(0)}
        className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
          value === 0
            ? "border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400"
            : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        Ablehnen
      </button>
    </div>
  );
}

/* ── Point Budget Indicator ────────────────────────────────────── */

function PointBudget({
  total,
  used,
  remaining,
}: {
  total: number;
  used: number;
  remaining: number;
}) {
  const percentage = total > 0 ? (used / total) * 100 : 0;
  const isOver = remaining < 0;

  return (
    <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">Punktebudget (W-Max)</span>
        <span
          className={`font-bold ${
            isOver
              ? "text-red-600 dark:text-red-400"
              : remaining <= total * 0.2
                ? "text-amber-600 dark:text-amber-400"
                : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {used} / {total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-600">
        <div
          className={`h-full rounded-full transition-all ${
            isOver
              ? "bg-red-500"
              : percentage > 80
                ? "bg-amber-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {isOver && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
          Budget um {Math.abs(remaining)} Punkte überschritten!
        </p>
      )}
    </div>
  );
}
