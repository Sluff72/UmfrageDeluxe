"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { VOTING_METHOD_LABELS } from "@/types/survey";
import {
  parseSurveysCsv,
  type CsvImportResult,
} from "@/lib/csvImport";

interface ImportSurveysDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const TEMPLATE_URL = "/templates/umfragen-import-vorlage.csv";

export default function ImportSurveysDialog({
  open,
  onClose,
  onImported,
}: ImportSurveysDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function reset() {
    setFileName(null);
    setResult(null);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    try {
      const text = await file.text();
      setResult(parseSurveysCsv(text));
    } catch {
      setResult({
        surveys: [],
        errors: [{ row: 0, message: "Datei konnte nicht gelesen werden" }],
      });
    }
  }

  async function handleImport() {
    if (!result || result.surveys.length === 0 || result.errors.length > 0) {
      return;
    }

    setIsImporting(true);
    try {
      const data = await api.post<{ count: number }>("/api/surveys/import", {
        surveys: result.surveys,
      });
      toast.success(
        `${data.count} ${data.count === 1 ? "Umfrage" : "Umfragen"} importiert`
      );
      handleClose();
      onImported();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Import fehlgeschlagen";
      toast.error(message);
      setIsImporting(false);
    }
  }

  if (!open) return null;

  const hasErrors = (result?.errors.length ?? 0) > 0;
  const canImport =
    !!result && result.surveys.length > 0 && !hasErrors && !isImporting;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto max-h-[85vh] w-[92vw] max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 dark:border-zinc-700 dark:bg-zinc-900"
      onClose={handleClose}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Umfragen importieren
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Lade eine CSV-Datei mit mehreren Umfragen hoch. Spalten:{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
            titel, beschreibung, art, w_max, max_punkte, anonym, option1, option2, …
          </code>{" "}
          Die importierten Umfragen landen als Entwurf.
        </p>

        <a
          href={TEMPLATE_URL}
          download
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          ↓ Beispiel-CSV herunterladen
        </a>

        <div className="mt-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelected}
            className="hidden"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            CSV-Datei wählen
          </button>
          {fileName && (
            <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
              {fileName}
            </span>
          )}
        </div>

        {result && (
          <div className="mt-5">
            {hasErrors && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
                <p className="font-medium text-red-700 dark:text-red-300">
                  {result.errors.length === 1
                    ? "1 Fehler gefunden – bitte korrigieren:"
                    : `${result.errors.length} Fehler gefunden – bitte korrigieren:`}
                </p>
                <ul className="mt-2 space-y-1 text-red-600 dark:text-red-400">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      {e.row > 0 ? `Zeile ${e.row}: ` : ""}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.surveys.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Vorschau ({result.surveys.length}{" "}
                  {result.surveys.length === 1 ? "Umfrage" : "Umfragen"})
                </p>
                <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      <tr>
                        <th className="px-3 py-2">Titel</th>
                        <th className="px-3 py-2">Art</th>
                        <th className="px-3 py-2 text-right">Optionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {result.surveys.map((s, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">
                            {s.title}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                            {VOTING_METHOD_LABELS[s.votingMethod]}
                          </td>
                          <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                            {s.options.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Abbrechen
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isImporting
              ? "Importiere..."
              : result && result.surveys.length > 0
                ? `${result.surveys.length} importieren`
                : "Importieren"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
