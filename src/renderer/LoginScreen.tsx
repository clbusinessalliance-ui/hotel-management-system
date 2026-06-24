import { useState } from "react";
import type { User } from "@shared/types/index.ts";
import { getBridge } from "./pmsClient.ts";

/** A mock user for browser-preview mode (no Electron bridge). UI only — no live data. */
const PREVIEW_USER: User = {
  id: "preview",
  username: "preview",
  displayName: "Preview (no backend)",
  roleIds: [],
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Login gate. In the desktop app it authenticates via the bridge (prefilled with
 * the dev admin / admin). In the browser preview (no bridge) it offers a UI-only
 * "Continue in preview" path so the shell stays browsable.
 */
export default function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const bridgeAvailable = getBridge() !== null;
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const bridge = getBridge();
    if (!bridge) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.login(username, password);
      if (!result.ok) setError(result.error);
      else onLogin(result.value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">🏨</div>
        <h1>Hotel PMS</h1>
        <p className="muted">Sign in to continue</p>
        {error && <p className="inline-error">{error}</p>}

        {bridgeAvailable ? (
          <>
            <label className="field">
              <span>Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
            </label>
            <button className="primary-btn login-btn" disabled={busy} onClick={() => void submit()}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="muted login-hint">Dev login prefilled — admin / admin</p>
          </>
        ) : (
          <>
            <p className="muted">
              Running in browser preview — sign-in needs the desktop app. Continue in preview to
              browse the UI (no live data).
            </p>
            <button
              className="primary-btn login-btn"
              onClick={() => onLogin(PREVIEW_USER)}
            >
              Continue in preview
            </button>
          </>
        )}
      </div>
    </div>
  );
}
