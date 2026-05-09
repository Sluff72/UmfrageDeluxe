"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { OptionsListSkeleton } from "@/components/Skeleton";
import type { SurveyOption, SurveyStatus, VotingMethod } from "@/types/survey";
import type { FreetextQuestion } from "@/types/freetext";

interface OptionExportEntry {
  title: string;
  description?: string;
}

interface OptionsExportFile {
  options: OptionExportEntry[];
}

const MAX_IMPORT_OPTIONS = 100;

/**
 * Accept either the object form `{ options: [...] }` or a bare array `[...]`
 * for robustness with hand-crafted JSON. Returns the canonical
 * `OptionExportEntry[]` shape or throws with a German error message.
 */
function parseImportedOptions(raw: unknown): OptionExportEntry[] {
  const rawArray = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as OptionsExportFile).options)
      ? (raw as OptionsExportFile).options
      : null;

  if (!rawArray) {
    throw new Error('Ungültiges Format: erwartet { "options": [...] } oder [...]');
  }

  if (rawArray.length === 0) {
    throw new Error("Die Datei enthält keine Optionen");
  }

  if (rawArray.length > MAX_IMPORT_OPTIONS) {
    throw new Error(`Maximal ${MAX_IMPORT_OPTIONS} Optionen pro Import erlaubt`);
  }

  return rawArray.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Eintrag ${index + 1}: kein Objekt`);
    }
    const title = (entry as Record<string, unknown>).title;
    const description = (entry as Record<string, unknown>).description;
    if (typeof title !== "string" || title.trim() === "") {
      throw new Error(`Eintrag ${index + 1}: "title" fehlt oder ist leer`);
    }
    if (description !== undefined && typeof description !== "string") {
      throw new Error(`Eintrag ${index + 1}: "description" muss ein String sein`);
    }
    return {
      title: title.trim(),
      ...(description && description.trim() !== ""
        ? { description: description.trim() }
        : {}),
    };
  });
}

interface OptionsListProps {
  surveyId: string;
  surveyStatus: SurveyStatus;
  votingMethod: VotingMethod;
  currentParticipantId: string | null;
  canManage: boolean;
  onOptionsChange?: () => void;
  /** Bumped externally (e.g. by socket events) to trigger a re-fetch */
  revision?: number;
}

export default function OptionsList({
  surveyId,
  surveyStatus,
  votingMethod,
  currentParticipantId,
  canManage,
  onOptionsChange,
  revision = 0,
}: OptionsListProps) {
  const [options, setOptions] = useState<SurveyOption[]>([]);
  const [questions, setQuestions] = useState<FreetextQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  const isFreitext = votingMethod === "freitext";
  const canAddOptions = surveyStatus === "optionen_sammeln";
  const canEditOptions = surveyStatus === "optionen_sammeln";
  const canEditQuestions =
    isFreitext &&
    canManage &&
    (surveyStatus === "entwurf" || surveyStatus === "optionen_sammeln");

  const fetchOptions = useCallback(async () => {
    try {
      const data = await api.get<{ options: SurveyOption[] }>(
        `/api/surveys/${surveyId}/options`
      );
      setOptions(data.options);
    } catch {
      setError("Optionen konnten nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  }, [surveyId]);

  const fetchQuestions = useCallback(async () => {
    if (!isFreitext) {
      setQuestions([]);
      return;
    }
    try {
      const data = await api.get<{ questions: FreetextQuestion[] }>(
        `/api/surveys/${surveyId}/questions`
      );
      setQuestions(data.questions);
    } catch {
      // Non-fatal; the questions section just shows nothing
    }
  }, [surveyId, isFreitext]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions, revision]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions, revision]);

  async function handleAddOption(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const data = await api.post<{ option: SurveyOption }>(
        `/api/surveys/${surveyId}/options`,
        {
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
        }
      );
      setOptions((prev) => [...prev, data.option]);
      setNewTitle("");
      setNewDescription("");
      onOptionsChange?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Option konnte nicht erstellt werden"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateOption(optionId: string) {
    if (!editTitle.trim()) return;

    setError(null);
    try {
      const data = await api.put<{ option: SurveyOption }>(
        `/api/options/${optionId}`,
        {
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
        }
      );
      setOptions((prev) =>
        prev.map((o) => (o.id === optionId ? data.option : o))
      );
      setEditingId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Option konnte nicht aktualisiert werden"
      );
    }
  }

  async function handleMoveOption(optionId: string, direction: "up" | "down") {
    setError(null);
    try {
      const data = await api.post<{ options: SurveyOption[] }>(
        `/api/options/${optionId}/move`,
        { direction }
      );
      setOptions(data.options);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Option konnte nicht verschoben werden"
      );
    }
  }

  async function handleDeleteOption(optionId: string) {
    setDeleteTarget(null);
    setError(null);
    try {
      await api.delete(`/api/options/${optionId}`);
      setOptions((prev) => prev.filter((o) => o.id !== optionId));
      toast.success("Option gelöscht");
      onOptionsChange?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Option konnte nicht gelöscht werden"
      );
    }
  }

  function handleExportOptions() {
    const payload: OptionsExportFile = {
      options: options.map((o) => ({
        title: o.title,
        ...(o.description ? { description: o.description } : {}),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `umfrage-optionen-${surveyId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast.success("Optionen exportiert");
  }

  async function handleImportFileSelected(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file again triggers onChange.
    event.target.value = "";
    if (!file) return;

    setError(null);
    setIsImporting(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Die Datei enthält kein gültiges JSON");
      }

      const importOptions = parseImportedOptions(parsed);

      const data = await api.post<{ options: SurveyOption[] }>(
        `/api/surveys/${surveyId}/options/import`,
        { options: importOptions }
      );

      // Socket broadcast will refresh other clients; update locally too.
      setOptions((prev) => [...prev, ...data.options]);
      toast.success(
        data.options.length === 1
          ? "1 Option importiert"
          : `${data.options.length} Optionen importiert`
      );
      onOptionsChange?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Import fehlgeschlagen";
      setError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  }

  function startEditing(option: SurveyOption) {
    setEditingId(option.id);
    setEditTitle(option.title);
    setEditDescription(option.description ?? "");
  }

  function canEditOption(option: SurveyOption): boolean {
    if (!canEditOptions) return false;
    return option.created_by === currentParticipantId || canManage;
  }

  const canReorderOptions = canEditOptions && canManage;
  const canImportOptions = canAddOptions && canManage;
  const canExportOptions = options.length > 0;

  if (isLoading) {
    return <OptionsListSkeleton />;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Optionen ({options.length})
        </h2>
        {(canExportOptions || canImportOptions) && (
          <div className="flex shrink-0 gap-2">
            {canExportOptions && (
              <button
                type="button"
                onClick={handleExportOptions}
                className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Exportieren
              </button>
            )}
            {canImportOptions && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFileSelected}
                  className="hidden"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {isImporting ? "Importiere..." : "Importieren"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Options list */}
      {options.length === 0 ? (
        <EmptyState
          icon="💡"
          title="Noch keine Optionen"
          description={canAddOptions ? "Füge die erste Option hinzu." : undefined}
        />
      ) : (
        <div className="mb-4 space-y-3">
          {options.map((option, index) => (
            <div
              key={option.id}
              className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {editingId === option.id ? (
                /* Edit mode */
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Beschreibung (optional)"
                    rows={2}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateOption(option.id)}
                      className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Speichern
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-start justify-between gap-2">
                  {canReorderOptions && (
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveOption(option.id, "up")}
                        disabled={index === 0}
                        aria-label={`Option "${option.title}" nach oben verschieben`}
                        className="rounded px-1.5 py-0.5 text-xs leading-none text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveOption(option.id, "down")}
                        disabled={index === options.length - 1}
                        aria-label={`Option "${option.title}" nach unten verschieben`}
                        className="rounded px-1.5 py-0.5 text-xs leading-none text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {option.title}
                    </p>
                    {option.description && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {option.description}
                      </p>
                    )}
                  </div>
                  {canEditOption(option) && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => startEditing(option)}
                        aria-label={`Option "${option.title}" bearbeiten`}
                        className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => setDeleteTarget(option.id)}
                        aria-label={`Option "${option.title}" löschen`}
                        className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      >
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isFreitext && (
                <FreetextQuestionsSection
                  surveyId={surveyId}
                  optionId={option.id}
                  questions={questions.filter(
                    (q) => q.option_id === option.id
                  )}
                  canEdit={canEditQuestions}
                  onChanged={() => {
                    fetchQuestions();
                    onOptionsChange?.();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Option löschen"
        message="Möchtest du diese Option wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={() => deleteTarget && handleDeleteOption(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Hint when freitext + no questions yet */}
      {isFreitext && options.length > 0 && questions.length === 0 && (
        <p className="-mt-1 mb-4 text-xs text-amber-600 dark:text-amber-400">
          Damit die Umfrage in die Phase &quot;Abstimmen&quot; wechseln kann,
          muss mindestens eine Frage definiert sein.
        </p>
      )}

      {/* Add option form */}
      {canAddOptions && (
        <form onSubmit={handleAddOption} className="space-y-3">
          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Neue Option..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Beschreibung (optional)"
              rows={2}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <button
              type="submit"
              disabled={!newTitle.trim() || isSubmitting}
              className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Wird hinzugefügt..." : "Option hinzufügen"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── Freetext Questions per Option ───────────────────────────────── */

function FreetextQuestionsSection({
  surveyId,
  optionId,
  questions,
  canEdit,
  onChanged,
}: {
  surveyId: string;
  optionId: string;
  questions: FreetextQuestion[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/api/surveys/${surveyId}/options/${optionId}/questions`,
        { text: trimmed }
      );
      setNewText("");
      setIsAdding(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Frage nicht gespeichert");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(questionId: string) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/surveys/${surveyId}/questions/${questionId}`, {
        text: trimmed,
      });
      setEditingId(null);
      setEditText("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Frage nicht aktualisiert");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(questionId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/surveys/${surveyId}/questions/${questionId}`);
      toast.success("Frage gelöscht");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Frage nicht gelöscht");
    } finally {
      setBusy(false);
    }
  }

  if (questions.length === 0 && !canEdit) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Fragen ({questions.length})
      </p>

      {error && (
        <p className="mb-2 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      <ul className="space-y-2">
        {questions.map((q) => (
          <li
            key={q.id}
            className="rounded-md border border-zinc-100 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {editingId === q.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  maxLength={500}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(q.id)}
                    disabled={busy || !editText.trim()}
                    className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditText("");
                    }}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 text-zinc-800 dark:text-zinc-200">
                  {q.text}
                </p>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditingId(q.id);
                        setEditText(q.text);
                      }}
                      className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      disabled={busy}
                      className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      Löschen
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-2">
          {isAdding ? (
            <form onSubmit={handleAdd} className="space-y-2">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Neue Frage..."
                maxLength={500}
                autoFocus
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || !newText.trim()}
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Hinzufügen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewText("");
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              + Frage hinzufügen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
