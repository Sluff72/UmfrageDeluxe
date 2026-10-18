"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";

const HTTP_STATUS_ACCOUNT_LOCKED = 423;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";
const MIN_PASSWORD_LENGTH = 8;

const INPUT_CLASS_NAME =
  "w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20";
const LABEL_CLASS_NAME =
  "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

type LoginStep = "credentials" | "newPassword";

function describeLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Ein unerwarteter Fehler ist aufgetreten";
  }
  if (error.statusCode === HTTP_STATUS_ACCOUNT_LOCKED) {
    return "Zu viele fehlgeschlagene Anmeldeversuche. Dieses Konto ist für 15 Minuten gesperrt – oder bis ein Admin es entsperrt.";
  }
  if (error.statusCode === HTTP_STATUS_TOO_MANY_REQUESTS) {
    return "Zu viele Anmeldeversuche aus diesem Netzwerk. Bitte versuche es in ein paar Minuten erneut.";
  }
  return error.message;
}

function isPasswordChangeRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === PASSWORD_CHANGE_REQUIRED_CODE;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, changePassword } = useAuth();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
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

  function redirectAfterLogin() {
    router.push(resolveRedirectTarget(searchParams.get("redirect")));
  }

  async function handleLoginSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ username, password });
      redirectAfterLogin();
    } catch (err) {
      if (isPasswordChangeRequired(err)) {
        setStep("newPassword");
      } else {
        setError(describeLoginError(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNewPasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein`);
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setError("Die Passwörter stimmen nicht überein");
      return;
    }
    if (newPassword === password) {
      setError("Das neue Passwort muss sich vom vorläufigen Passwort unterscheiden");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({ username, currentPassword: password, newPassword });
      redirectAfterLogin();
    } catch (err) {
      setError(describeLoginError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isNewPasswordStep = step === "newPassword";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            UmfrageDeluxe
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {isNewPasswordStep
              ? "Bitte vergib ein neues Passwort"
              : "Melde dich an, um fortzufahren"}
          </p>
        </div>

        <form
          onSubmit={isNewPasswordStep ? handleNewPasswordSubmit : handleLoginSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="space-y-5">
            {isNewPasswordStep ? (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Dein Passwort wurde zurückgesetzt. Lege jetzt ein eigenes Passwort
                  für <strong>{username}</strong> fest.
                </p>
                <div>
                  <label htmlFor="new-password" className={LABEL_CLASS_NAME}>
                    Neues Passwort
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    minLength={MIN_PASSWORD_LENGTH}
                    className={INPUT_CLASS_NAME}
                    placeholder={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
                  />
                </div>
                <div>
                  <label htmlFor="new-password-confirmation" className={LABEL_CLASS_NAME}>
                    Neues Passwort wiederholen
                  </label>
                  <input
                    id="new-password-confirmation"
                    type="password"
                    autoComplete="new-password"
                    value={newPasswordConfirmation}
                    onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                    required
                    className={INPUT_CLASS_NAME}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="username" className={LABEL_CLASS_NAME}>
                    Benutzername
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    className={INPUT_CLASS_NAME}
                    placeholder="Dein Benutzername"
                  />
                </div>

                <div>
                  <label htmlFor="password" className={LABEL_CLASS_NAME}>
                    Passwort
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={INPUT_CLASS_NAME}
                    placeholder="Dein Passwort"
                  />
                </div>
              </>
            )}

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
              {isNewPasswordStep
                ? isSubmitting
                  ? "Speichern..."
                  : "Passwort speichern und anmelden"
                : isSubmitting
                  ? "Anmelden..."
                  : "Anmelden"}
            </button>
          </div>

          {!isNewPasswordStep && (
            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Noch kein Konto?{" "}
              <Link
                href="/register"
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                Registrieren
              </Link>
            </p>
          )}
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
