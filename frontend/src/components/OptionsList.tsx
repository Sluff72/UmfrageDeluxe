"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { OptionsListSkeleton } from "@/components/Skeleton";
import type { SurveyOption, SurveyStatus } from "@/types/survey";

interface OptionsListProps {
  surveyId: string;
  surveyStatus: SurveyStatus;
  currentParticipantId: string | null;
  canManage: boolean;
  onOptionsChange?: () => void;
  /** Bumped externally (e.g. by socket events) to trigger a re-fetch */
  revision?: number;
}

export default function OptionsList({
  surveyId,
  surveyStatus,
  currentParticipantId,
  canManage,
  onOptionsChange,
  revision = 0,
}: OptionsListProps) {
  const [options, setOptions] = useState<SurveyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const toast = useToast();

  const canAddOptions = surveyStatus === "optionen_sammeln";
  const canEditOptions = surveyStatus === "optionen_sammeln";

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

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions, revision]);

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

  function startEditing(option: SurveyOption) {
    setEditingId(option.id);
    setEditTitle(option.title);
    setEditDescription(option.description ?? "");
  }

  function canEditOption(option: SurveyOption): boolean {
    if (!canEditOptions) return false;
    return option.created_by === currentParticipantId || canManage;
  }

  if (isLoading) {
    return <OptionsListSkeleton />;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Optionen ({options.length})
      </h2>

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
          {options.map((option) => (
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
