"use client";

import { useEffect, useState } from "react";

interface HealthStatus {
  status: string;
  timestamp: string;
  service: string;
}

export default function Home() {
  const [backendHealth, setBackendHealth] = useState<HealthStatus | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    fetch(`${apiUrl}/api/health`)
      .then((response) => response.json())
      .then((data: HealthStatus) => {
        setBackendHealth(data);
        setConnectionError(null);
      })
      .catch((error) => {
        setConnectionError(error.message);
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <main className="flex flex-col items-center gap-8 p-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          UmfrageDeluxe
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Konsensorientiertes Online-Umfragetool
        </p>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Backend-Verbindung
          </h2>
          {backendHealth ? (
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {backendHealth.service} &mdash; {backendHealth.status}
              </span>
            </div>
          ) : connectionError ? (
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-sm text-red-600 dark:text-red-400">
                Verbindung fehlgeschlagen: {connectionError}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
              <span className="text-sm text-zinc-500">Verbinde...</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
