"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import type { Survey, VotingMethod } from "@/types/survey";
import { VOTING_METHOD_LABELS } from "@/types/survey";

export default function NewSurveyPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [votingMethod, setVotingMethod] = useState<VotingMethod>("widerstand");
  const [wMax, setWMax] = useState<number>(20);
  const [maxPointsPerOption, setMaxPointsPerOption] = useState<number>(5);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && !isAuthenticated) {
    router.push("/login");
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        title,
        description: description || undefined,
        votingMethod,
      };

      if (votingMethod === "widerstand_punkte") {
        body.wMax = wMax;
        body.maxPointsPerOption = maxPointsPerOption;
      }

      const data = await api.post<{ survey: Survey }>("/api/surveys", body);
      router.push(`/survey/${data.survey.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Ein unerwarteter Fehler ist aufgetreten");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            &larr; Zurück
          </Link>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Neue Umfrage
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="space-y-6">
            <div>
              <label
                htmlFor="title"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Titel
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                placeholder="Name deiner Umfrage"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Beschreibung{" "}
                <span className="text-zinc-400">(optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                placeholder="Worum geht es in dieser Umfrage?"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Abstimmungsmethode
              </label>
              <div className="grid gap-3">
                {(
                  Object.entries(VOTING_METHOD_LABELS) as [
                    VotingMethod,
                    string
                  ][]
                ).map(([method, label]) => (
                  <label
                    key={method}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
                      votingMethod === method
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-300 dark:bg-zinc-800"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="votingMethod"
                      value={method}
                      checked={votingMethod === method}
                      onChange={() => setVotingMethod(method)}
                      className="accent-zinc-900 dark:accent-zinc-300"
                    />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {votingMethod === "widerstand_punkte" && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div>
                  <label
                    htmlFor="wMax"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    W-Max (Gesamt-Punktebudget)
                  </label>
                  <input
                    id="wMax"
                    type="number"
                    value={wMax}
                    onChange={(e) => setWMax(parseInt(e.target.value) || 0)}
                    min={1}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="maxPoints"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Max. Punkte pro Option
                  </label>
                  <input
                    id="maxPoints"
                    type="number"
                    value={maxPointsPerOption}
                    onChange={(e) =>
                      setMaxPointsPerOption(parseInt(e.target.value) || 1)
                    }
                    min={1}
                    max={10}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isSubmitting ? "Erstellen..." : "Umfrage erstellen"}
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg border border-zinc-300 px-6 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Abbrechen
              </Link>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
