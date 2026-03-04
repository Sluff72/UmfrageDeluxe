"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type {
  SurveyStatus,
  TransitionInfo,
  TransitionOption,
} from "@/types/survey";
import { SURVEY_STATUS_LABELS } from "@/types/survey";

// Human-readable labels for each transition button
const TRANSITION_LABELS: Record<string, Record<string, string>> = {
  entwurf: {
    optionen_sammeln: "Optionensammlung starten",
  },
  optionen_sammeln: {
    abstimmen: "Abstimmung starten",
  },
  abstimmen: {
    einwand_integration: "Einwandphase starten",
    beendet: "Umfrage beenden",
  },
  einwand_integration: {
    abstimmen: "Erneut abstimmen",
    beendet: "Umfrage beenden",
  },
};

// Phase flow visualization
const PHASE_ORDER: SurveyStatus[] = [
  "entwurf",
  "optionen_sammeln",
  "abstimmen",
  "einwand_integration",
  "beendet",
];

interface PhaseControllerProps {
  surveyId: string;
  transitionInfo: TransitionInfo;
  canManage: boolean;
  onTransitionComplete: () => void;
}

export default function PhaseController({
  surveyId,
  transitionInfo,
  canManage,
  onTransitionComplete,
}: PhaseControllerProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<SurveyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const toast = useToast();

  const currentIndex = PHASE_ORDER.indexOf(transitionInfo.currentStatus);

  async function handleTransition(targetStatus: SurveyStatus) {
    setIsTransitioning(true);
    setError(null);
    setWarning(null);

    try {
      const result = await api.post<{
        survey: { status: SurveyStatus };
        previousStatus: SurveyStatus;
        warning?: string;
      }>(`/api/surveys/${surveyId}/transition`, { targetStatus });

      if (result.warning) {
        setWarning(result.warning);
      }

      toast.success(
        `Phase gewechselt: ${SURVEY_STATUS_LABELS[targetStatus]}`
      );
      setConfirmTarget(null);
      onTransitionComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Phasenübergang fehlgeschlagen"
      );
    } finally {
      setIsTransitioning(false);
    }
  }

  function handleButtonClick(transition: TransitionOption) {
    if (!transition.allowed) return;

    // For destructive transitions (beendet), show confirmation
    if (transition.targetStatus === "beendet") {
      setConfirmTarget(transition.targetStatus);
      return;
    }

    // If there's a warning, show confirmation
    if (transition.warning) {
      setWarning(transition.warning);
      setConfirmTarget(transition.targetStatus);
      return;
    }

    handleTransition(transition.targetStatus);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Phasen
      </h3>

      {/* Phase progress indicator */}
      <div className="mb-6 flex items-center gap-1" role="group" aria-label="Umfrage-Fortschritt">
        {PHASE_ORDER.map((phase, index) => {
          const isActive = index === currentIndex;
          const isPast = index < currentIndex;

          return (
            <div key={phase} className="flex flex-1 flex-col items-center">
              <div
                className={`h-2 w-full rounded-full transition-colors ${
                  isActive
                    ? "bg-blue-500 dark:bg-blue-400"
                    : isPast
                      ? "bg-emerald-400 dark:bg-emerald-500"
                      : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
              <span
                className={`mt-1 text-[10px] leading-tight ${
                  isActive
                    ? "font-semibold text-blue-600 dark:text-blue-400"
                    : isPast
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {SURVEY_STATUS_LABELS[phase]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Voting round info */}
      {transitionInfo.votingRound > 1 && (
        <p className="mb-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Abstimmungsrunde: {transitionInfo.votingRound}
        </p>
      )}

      {/* Transition buttons (only for host/co-host) */}
      {canManage && transitionInfo.availableTransitions.length > 0 && (
        <div className="space-y-2">
          {transitionInfo.availableTransitions.map((transition) => {
            const label =
              TRANSITION_LABELS[transitionInfo.currentStatus]?.[
                transition.targetStatus
              ] ?? `Zu ${SURVEY_STATUS_LABELS[transition.targetStatus]}`;

            return (
              <div key={transition.targetStatus}>
                <button
                  onClick={() => handleButtonClick(transition)}
                  disabled={!transition.allowed || isTransitioning}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    !transition.allowed
                      ? "cursor-not-allowed border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                      : transition.targetStatus === "beendet"
                        ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-900/40"
                        : "border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40"
                  }`}
                >
                  {isTransitioning ? "Wird durchgeführt..." : label}
                </button>
                {!transition.allowed && transition.reason && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    {transition.reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No transitions available */}
      {transitionInfo.availableTransitions.length === 0 && (
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          {transitionInfo.currentStatus === "beendet"
            ? "Die Umfrage ist beendet."
            : "Keine Phasenübergänge verfügbar."}
        </p>
      )}

      {/* Confirmation dialog */}
      {confirmTarget && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="mb-1 text-sm font-medium text-amber-800 dark:text-amber-300">
            {confirmTarget === "beendet"
              ? "Umfrage wirklich beenden?"
              : `Wirklich zu "${SURVEY_STATUS_LABELS[confirmTarget]}" wechseln?`}
          </p>
          {warning && (
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
              {warning}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleTransition(confirmTarget)}
              disabled={isTransitioning}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              {isTransitioning ? "..." : "Bestätigen"}
            </button>
            <button
              onClick={() => {
                setConfirmTarget(null);
                setWarning(null);
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <p className="mt-3 text-center text-xs text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
