"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";

const HTTP_STATUS_ACCOUNT_LOCKED = 423;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

function describeLoginError(error: ApiError): string {
  if (error.statusCode === HTTP_STATUS_ACCOUNT_LOCKED) {
    return "Zu viele fehlgeschlagene Anmeldeversuche. Dieses Konto ist für 15 Minuten gesperrt – oder bis ein Admin es entsperrt.";
  }
  if (error.statusCode === HTTP_STATUS_TOO_MANY_REQUESTS) {
    return "Zu viele Anmeldeversuche aus diesem Netzwerk. Bitte versuche es in ein paar Minuten erneut.";
  }
  return error.message;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resolveRedirectTarget(rawRedirect: string | null): string {
    if (!rawRedirect) {
      return "/dashboard";
    }

    // Only allow internal absolute paths and block protocol-relative redirects (//...).
    if (!rawRedirect.startsWith("/") || rawRedirect.startsWith("//")) {
      return "/dashboard";
    }

    return rawRedirect;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ username, password });
      const redirectTo = resolveRedirectTarget(searchParams.get("redirect"));
      router.push(redirectTo);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(describeLoginError(err));
      } else {
        setError("Ein unerwarteter Fehler ist aufgetreten");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            UmfrageDeluxe
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Melde dich an, um fortzufahren
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Benutzername
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                placeholder="Dein Benutzername"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                placeholder="Dein Passwort"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isSubmitting ? "Anmelden..." : "Anmelden"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Noch kein Konto?{" "}
            <Link
              href="/register"
              className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              Registrieren
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <div className="text-zinc-500">Laden...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
