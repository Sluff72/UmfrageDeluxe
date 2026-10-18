import { API_URL } from "./constants";
import { getParticipantTokenForSurvey } from "@/hooks/useParticipantToken";

class ApiClient {
  private baseUrl: string;

  /**
   * When set, the API client will include X-Participant-Token and X-Survey-Id
   * headers for anonymous participant authentication.
   */
  private activeSurveyId: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the active survey context. All subsequent requests will include
   * anonymous participant headers if a token exists for this survey
   * and no JWT is available.
   */
  setSurveyContext(surveyId: string | null): void {
    this.activeSurveyId = surveyId;
  }

  private buildHeaders(extraHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };

    if (this.activeSurveyId) {
      // Use anonymous participant token for survey-scoped guest access.
      const entry = getParticipantTokenForSurvey(this.activeSurveyId);
      if (entry) {
        headers["X-Participant-Token"] = entry.token;
        headers["X-Survey-Id"] = entry.surveyId;
      }
    }

    return headers;
  }

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: this.buildHeaders(options.headers as Record<string, string>),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        error: "Unknown error",
      }));
      throw new ApiError(
        response.status,
        errorBody.error || "Request failed",
        errorBody.code
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    /** Machine-readable error code from the backend, e.g. "ACCOUNT_LOCKED" */
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = new ApiClient(API_URL);
