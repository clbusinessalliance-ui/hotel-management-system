import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Role, User } from "@shared/types/index.ts";
import { hasPermission } from "@core/auth/index.ts";

/**
 * Renderer auth context: exposes the signed-in user and a `can(permission)`
 * helper (wildcard-aware, backed by the core's hasPermission). Screens use it to
 * hide write controls a role isn't allowed to use.
 */
interface Auth {
  user: User;
  can: (permission: string) => boolean;
}

const AuthCtx = createContext<Auth | null>(null);

export function AuthProvider({
  user,
  roles,
  children,
}: {
  user: User;
  roles: Role[];
  children: ReactNode;
}) {
  const value = useMemo<Auth>(
    () => ({ user, can: (p) => hasPermission(user, roles, p) }),
    [user, roles]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
