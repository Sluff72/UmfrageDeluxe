"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import Header from "@/components/Header";
import type { Survey, VotingMethod } from "@/types/survey";
import { VOTING_METHOD_LABELS } from "@/types/survey";

const VOTING_METHOD_DESCRIPTIONS: Record<VotingMethod, string> = {
  widerstand_punkte:
    "Teilnehmer verteilen Widerstandspunkte (0–10) mit begrenztem Budget.",
  widerstand:
    "Teilnehmer bewerten ihren Widerstand (0–10) pro Option ohne Limit.",
  mehrheit: "Einfach Zustimmen oder Ablehnen pro Option.",
  freitext:
    "Teilnehmer beantworten zu jeder Option freie Fragen mit eigenen Worten.",
};

export default function NewSurveyPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [votingMethod, setVotingMethod] = useState<VotingMethod>("widerstand");
  const [showAnswerAuthors, setShowAnswerAuthors] = useState(true);
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

      if (votingMethod === "freitext") {
        body.showAnswerAuthors = showAnswerAuthors;
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
      <Header title="Neue Umfrage" backHref="/dashboard" />

      <main id="main-content" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
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
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
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
                      className="mt-0.5 accent-zinc-900 dark:accent-zinc-300"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {label}
                      </span>
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                        {VOTING_METHOD_DESCRIPTIONS[method]}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {votingMethod === "freitext" && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
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
                      Wenn deaktiviert, werden Freitext-Antworten anonym
                      dargestellt – auch für Host und Co-Host.
                    </p>
                  </div>
                </label>
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
