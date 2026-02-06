"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError } from "@/lib/api";
import type {
  UserPublic,
  AuthResponse,
  RegisterInput,
  LoginInput,
} from "@/types/user";

interface AuthContextValue {
  user: UserPublic | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    api
      .get<{ user: UserPublic }>("/api/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => {
        localStorage.removeItem("token");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.post<AuthResponse>("/api/auth/login", input);
    localStorage.setItem("token", response.token);
    setUser(response.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user } = await api.post<{ user: UserPublic }>(
      "/api/auth/register",
      input
    );

    // Auto-login after registration
    const loginResponse = await api.post<AuthResponse>("/api/auth/login", {
      username: input.username,
      password: input.password,
    });
    localStorage.setItem("token", loginResponse.token);
    setUser(loginResponse.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    api.post("/api/auth/logout").catch(() => {
      // Cookie cleanup is best-effort
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
