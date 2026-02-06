"use client";

import { useCallback, useMemo } from "react";

/**
 * Manages anonymous participant tokens in localStorage.
 *
 * Tokens are stored per survey: participantToken:<surveyId> = <token>
 * This allows a user to participate anonymously in multiple surveys
 * with separate identities.
 */

const STORAGE_PREFIX = "participantToken:";

interface ParticipantTokenEntry {
  token: string;
  participantId: string;
  surveyId: string;
}

function buildKey(surveyId: string): string {
  return `${STORAGE_PREFIX}${surveyId}`;
}

export function useParticipantToken(surveyId: string | null) {
  const getToken = useCallback((): ParticipantTokenEntry | null => {
    if (typeof window === "undefined" || !surveyId) return null;

    try {
      const raw = localStorage.getItem(buildKey(surveyId));
      if (!raw) return null;
      return JSON.parse(raw) as ParticipantTokenEntry;
    } catch {
      return null;
    }
  }, [surveyId]);

  const setToken = useCallback(
    (token: string, participantId: string) => {
      if (typeof window === "undefined" || !surveyId) return;

      const entry: ParticipantTokenEntry = {
        token,
        participantId,
        surveyId,
      };
      localStorage.setItem(buildKey(surveyId), JSON.stringify(entry));
    },
    [surveyId]
  );

  const removeToken = useCallback(() => {
    if (typeof window === "undefined" || !surveyId) return;
    localStorage.removeItem(buildKey(surveyId));
  }, [surveyId]);

  return useMemo(
    () => ({ getToken, setToken, removeToken }),
    [getToken, setToken, removeToken]
  );
}

/**
 * Standalone helpers for use outside of React components (e.g. in ApiClient).
 */
export function getParticipantTokenForSurvey(
  surveyId: string
): ParticipantTokenEntry | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(buildKey(surveyId));
    if (!raw) return null;
    return JSON.parse(raw) as ParticipantTokenEntry;
  } catch {
    return null;
  }
}

export function setParticipantTokenForSurvey(
  surveyId: string,
  token: string,
  participantId: string
): void {
  if (typeof window === "undefined") return;

  const entry: ParticipantTokenEntry = {
    token,
    participantId,
    surveyId,
  };
  localStorage.setItem(buildKey(surveyId), JSON.stringify(entry));
}
