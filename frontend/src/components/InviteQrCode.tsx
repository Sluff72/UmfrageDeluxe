"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface InviteQrCodeProps {
  inviteCode: string;
  surveyTitle: string;
}

/**
 * QR code for the invite link. Rendered on a white tile so scanners get
 * enough contrast in dark mode too. Includes a fullscreen presentation
 * mode (for projectors) and a PNG download.
 */
export default function InviteQrCode({
  inviteCode,
  surveyTitle,
}: InviteQrCodeProps) {
  // window.location is only available after mount (client components are
  // still prerendered on the server)
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInviteLink(`${window.location.origin}/join/${inviteCode}`);
  }, [inviteCode]);

  const closeFullscreen = useCallback(() => setIsFullscreen(false), []);

  useEffect(() => {
    if (!isFullscreen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeFullscreen();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, closeFullscreen]);

  function downloadPng() {
    const canvas = downloadRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `einladung-${inviteCode}.png`;
    link.click();
  }

  if (!inviteLink) return null;

  return (
    <div className="mt-4">
      <div className="flex justify-center">
        <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700">
          <QRCodeCanvas
            value={inviteLink}
            size={144}
            marginSize={1}
            aria-label={`QR-Code für den Einladungslink ${inviteLink}`}
            role="img"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Für Beamer anzeigen
        </button>
        <button
          type="button"
          onClick={downloadPng}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Als PNG speichern
        </button>
      </div>

      {/* Hidden high-resolution canvas used for the PNG download */}
      <div ref={downloadRef} className="hidden" aria-hidden="true">
        <QRCodeCanvas value={inviteLink} size={1024} marginSize={2} />
      </div>

      {/* Fullscreen presentation mode */}
      {isFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="QR-Code Vollbildansicht"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-8"
          onClick={closeFullscreen}
        >
          <h2 className="max-w-3xl text-center text-3xl font-bold text-zinc-900">
            {surveyTitle}
          </h2>
          <QRCodeCanvas
            value={inviteLink}
            size={Math.min(480, typeof window !== "undefined" ? window.innerHeight - 280 : 480)}
            marginSize={2}
          />
          <div className="text-center">
            <p className="text-2xl font-semibold tracking-widest text-zinc-900">
              {inviteCode}
            </p>
            <p className="mt-1 text-lg text-zinc-500">{inviteLink}</p>
          </div>
          <button
            type="button"
            onClick={closeFullscreen}
            className="rounded-lg border border-zinc-300 px-6 py-2 text-sm text-zinc-600 transition hover:bg-zinc-100"
          >
            Schließen (Esc)
          </button>
        </div>
      )}
    </div>
  );
}
