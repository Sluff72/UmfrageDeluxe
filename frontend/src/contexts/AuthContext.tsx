"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";
import type {
  UserPublic,
  AuthResponse,
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
} from "@/types/user";

interface AuthContextValue {
  user: UserPublic | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing cookie-based session on mount
  useEffect(() => {
    api
      .get<{ user: UserPublic }>("/api/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => {
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.post<AuthResponse>("/api/auth/login", input);
    setUser(response.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    await api.post<{ user: UserPublic }>(
      "/api/auth/register",
      input
    );

    // Auto-login after registration to establish the auth cookie
    const loginResponse = await api.post<AuthResponse>("/api/auth/login", {
      username: input.username,
      password: input.password,
    });
    setUser(loginResponse.user);
  }, []);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    const response = await api.post<AuthResponse>(
      "/api/auth/change-password",
      input
    );
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
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
      changePassword,
      logout,
    }),
    [user, isLoading, login, register, changePassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
