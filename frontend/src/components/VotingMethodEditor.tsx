"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Survey, VotingMethod } from "@/types/survey";
import { VOTING_METHOD_LABELS } from "@/types/survey";

interface VotingMethodEditorProps {
  open: boolean;
  survey: Survey;
  onClose: () => void;
  onUpdated: (survey: Survey) => void;
}

const VOTING_METHOD_DESCRIPTIONS: Record<VotingMethod, string> = {
  widerstand_punkte:
    "Teilnehmer verteilen Widerstandspunkte (0–10) mit begrenztem Budget.",
  widerstand:
    "Teilnehmer bewerten ihren Widerstand (0–10) pro Option ohne Limit.",
  mehrheit: "Einfach Zustimmen oder Ablehnen pro Option.",
  freitext:
    "Teilnehmer beantworten zu jeder Option freie Fragen mit eigenen Worten.",
};

export default function VotingMethodEditor({
  open,
  survey,
  onClose,
  onUpdated,
}: VotingMethodEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [method, setMethod] = useState<VotingMethod>(survey.voting_method);
  const [wMax, setWMax] = useState<string>(
    survey.w_max !== null ? String(survey.w_max) : ""
  );
  const [maxPoints, setMaxPoints] = useState<string>(
    survey.max_points_per_option !== null
      ? String(survey.max_points_per_option)
      : ""
  );
  const [showAnswerAuthors, setShowAnswerAuthors] = useState<boolean>(
    survey.show_answer_authors === 1
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local state when the modal is opened so stale edits don't leak in.
  useEffect(() => {
    if (open) {
      setMethod(survey.voting_method);
      setWMax(survey.w_max !== null ? String(survey.w_max) : "");
      setMaxPoints(
        survey.max_points_per_option !== null
          ? String(survey.max_points_per_option)
          : ""
      );
      setShowAnswerAuthors(survey.show_answer_authors === 1);
      setError(null);
    }
  }, [open, survey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    const body: Record<string, unknown> = { votingMethod: method };

    if (method === "freitext") {
      body.showAnswerAuthors = showAnswerAuthors;
    }

    if (method === "widerstand_punkte") {
      if (maxPoints !== "") {
        const parsed = Number(maxPoints);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
          setError("Max. Punkte pro Option muss zwischen 1 und 10 liegen");
          setIsSaving(false);
          return;
        }
        body.maxPointsPerOption = parsed;
      }
      if (wMax !== "") {
        const parsed = Number(wMax);
        if (!Number.isInteger(parsed) || parsed < 1) {
          setError("W-Max muss eine positive ganze Zahl sein");
          setIsSaving(false);
          return;
        }
        body.wMax = parsed;
      }
    }

    try {
      const data = await api.put<{ survey: Survey }>(
        `/api/surveys/${survey.id}`,
        body
      );
      onUpdated(data.survey);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Aktualisierung fehlgeschlagen"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 dark:border-zinc-700 dark:bg-zinc-900"
      onClose={onClose}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Abstimmungsmethode ändern
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Gilt ab Beginn der Abstimmphase. Bestehende Optionen bleiben erhalten.
        </p>

        <div className="mt-4 grid gap-3">
          {(
            Object.entries(VOTING_METHOD_LABELS) as [VotingMethod, string][]
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                method === value
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-300 dark:bg-zinc-800"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="votingMethod"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
                className="mt-0.5 accent-zinc-900 dark:accent-zinc-300"
              />
              <div>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {label}
                </span>
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  {VOTING_METHOD_DESCRIPTIONS[value]}
                </p>
              </div>
            </label>
          ))}
        </div>

        {method === "freitext" && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={showAnswerAuthors}
                onChange={(e) => setShowAnswerAuthors(e.target.checked)}
                className="mt-0.5 accent-zinc-900 dark:accent-zinc-300"
              />
              <div>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Antworten mit Autor-Name anzeigen
                </span>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Wenn deaktiviert, werden Antworten anonym dargestellt – auch
                  für Host und Co-Host.
                </p>
              </div>
            </label>
          </div>
        )}

        {method === "widerstand_punkte" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="w-max"
                className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                W-Max <span className="text-zinc-400">(optional)</span>
              </label>
              <input
                id="w-max"
                type="number"
                min={1}
                value={wMax}
                onChange={(e) => setWMax(e.target.value)}
                placeholder="z.B. 25"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label
                htmlFor="max-points"
                className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Max. Punkte pro Option
              </label>
              <input
                id="max-points"
                type="number"
                min={1}
                max={10}
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
                placeholder="1–10"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isSaving ? "Speichere..." : "Speichern"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
