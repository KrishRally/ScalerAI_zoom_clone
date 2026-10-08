"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler } from "@/lib/api";
import { clearAuthToken, getAuthToken, markSignedOut, saveAuthToken } from "@/lib/session";
import type { User, UserSettings } from "@/lib/types";

interface AuthState {
  /** The signed in user, or null for guests. */
  user: User | null;
  /** Their personal defaults from the Settings page. */
  settings: UserSettings | null;
  /** True until we know whether someone is signed in. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
  updateSettings: (changes: Partial<UserSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const forget = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setSettings(null);
  }, []);

  /** Load the account for the saved token, if there is one. */
  const loadAccount = useCallback(async () => {
    if (!getAuthToken()) {
      setLoading(false);
      return;
    }
    try {
      const [me, mySettings] = await Promise.all([api.me(), api.getUserSettings()]);
      setUser(me);
      setSettings(mySettings);
    } catch {
      // Token expired or was signed out elsewhere.
      forget();
    } finally {
      setLoading(false);
    }
  }, [forget]);

  useEffect(() => {
    loadAccount();
    // If any request says we're no longer signed in, drop the account.
    setUnauthorizedHandler(forget);
    return () => setUnauthorizedHandler(null);
  }, [loadAccount, forget]);

  const finishSignIn = useCallback(async (token: string, signedIn: User) => {
    saveAuthToken(token);
    markSignedOut(false);
    setUser(signedIn);
    setSettings(await api.getUserSettings());
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      settings,
      loading,
      signIn: async (email, password) => {
        const res = await api.signIn(email, password);
        await finishSignIn(res.token, res.user);
      },
      signUp: async (name, email, password) => {
        const res = await api.signUp(name, email, password);
        await finishSignIn(res.token, res.user);
      },
      signOut: async () => {
        await api.signOut().catch(() => {});
        markSignedOut(true);
        forget();
      },
      setUser,
      updateSettings: async (changes) => {
        setSettings((prev) => (prev ? { ...prev, ...changes } : prev)); // feels instant
        setSettings(await api.updateUserSettings(changes));
      },
    }),
    [user, settings, loading, finishSignIn, forget],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
