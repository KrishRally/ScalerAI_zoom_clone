"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface UserState {
  user: User | null;
  error: string | null;
}

const UserContext = createContext<UserState>({ user: null, error: null });

/** The signed in user. There is no login, so this is always the seeded default user. */
export const useCurrentUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UserState>({ user: null, error: null });

  useEffect(() => {
    api
      .me()
      .then((user) => setState({ user, error: null }))
      .catch((e: Error) => setState({ user: null, error: e.message }));
  }, []);

  return <UserContext.Provider value={state}>{children}</UserContext.Provider>;
}
