import { useEffect, useMemo, useState } from "react";
import type { Role, User } from "@shared/types/index.ts";
import { hasPermission } from "@core/auth/index.ts";
import { NAV_ITEMS } from "./navigation.ts";
import { getBridge } from "./pmsClient.ts";
import { AuthProvider } from "./authContext.tsx";
import LoginScreen from "./LoginScreen.tsx";
import DashboardPanel from "./DashboardPanel.tsx";
import ReservationsPanel from "./ReservationsPanel.tsx";
import RoomsPanel from "./RoomsPanel.tsx";
import GuestsPanel from "./GuestsPanel.tsx";
import HousekeepingPanel from "./HousekeepingPanel.tsx";
import BillingPanel from "./BillingPanel.tsx";
import ReportsPanel from "./ReportsPanel.tsx";
import AccessPanel from "./AccessPanel.tsx";
import PropertyPanel from "./PropertyPanel.tsx";
import UsersRolesPanel from "./UsersRolesPanel.tsx";

/**
 * App shell: a login gate, then a fixed sidebar + content area. Router-free
 * (single dependency-light state switch).
 */
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [active, setActive] = useState(NAV_ITEMS[0].key);

  // Load roles after sign-in so we can resolve the user's permissions.
  useEffect(() => {
    if (!user) {
      setRoles([]);
      return;
    }
    const bridge = getBridge();
    if (bridge) void bridge.listRoles().then(setRoles).catch(() => setRoles([]));
  }, [user]);

  // Nav items the signed-in user may see (by role permissions). When roles aren't
  // loaded (e.g. browser preview with no bridge) we can't evaluate permissions, so
  // we fail open and show everything — real enforcement is server-side anyway.
  const navItems = useMemo(() => {
    if (!user) return [];
    if (roles.length === 0) return NAV_ITEMS;
    return NAV_ITEMS.filter(
      (n) => !n.requiredPermission || hasPermission(user, roles, n.requiredPermission)
    );
  }, [user, roles]);

  if (!user) return <LoginScreen onLogin={setUser} />;

  // If the active tab isn't permitted, fall back to the first available one.
  const effectiveActive = navItems.some((n) => n.key === active)
    ? active
    : navItems[0]?.key ?? "dashboard";
  const current = navItems.find((n) => n.key === effectiveActive) ?? NAV_ITEMS[0];

  return (
    <AuthProvider user={user} roles={roles}>
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">🏨</span>
          <div>
            <div className="brand-title">Hotel PMS</div>
            <div className="brand-sub">Guesthouse Edition</div>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={"nav-item" + (item.key === effectiveActive ? " active" : "")}
              onClick={() => setActive(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{user.displayName}</div>
          <button
            className="signout-btn"
            onClick={() => {
              getBridge()?.logout();
              setUser(null);
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="content-header">
          <h1>
            <span className="content-icon">{current.icon}</span> {current.label}
          </h1>
          <p className="content-desc">{current.description}</p>
        </header>

        {effectiveActive === "dashboard" ? (
          <DashboardPanel />
        ) : effectiveActive === "reservations" ? (
          <ReservationsPanel />
        ) : effectiveActive === "rooms" ? (
          <RoomsPanel />
        ) : effectiveActive === "guests" ? (
          <GuestsPanel />
        ) : effectiveActive === "housekeeping" ? (
          <HousekeepingPanel />
        ) : effectiveActive === "billing" ? (
          <BillingPanel />
        ) : effectiveActive === "reports" ? (
          <ReportsPanel />
        ) : effectiveActive === "access" ? (
          <AccessPanel />
        ) : effectiveActive === "property" ? (
          <PropertyPanel />
        ) : effectiveActive === "users" ? (
          <UsersRolesPanel />
        ) : (
          <section className="placeholder-card">
            <h2>Module scaffold</h2>
            <p>
              This is the <strong>{current.label}</strong> module. Its UI is not built yet —
              the screen is wired to the navigation shell only.
            </p>
            <p className="muted">
              Domain logic for this module lives under <code>src/core/</code> (pure TypeScript),
              and is reachable from the desktop host today, and from a cloud API later — without
              changing this UI.
            </p>
          </section>
        )}
      </main>
    </div>
    </AuthProvider>
  );
}
