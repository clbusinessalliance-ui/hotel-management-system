import { useCallback, useEffect, useMemo, useState } from "react";
import type { Role, User } from "@shared/types/index.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";

type FormMode = "create" | "edit";

/** Users & Roles: list/create/edit staff accounts, and view the role/permission matrix. */
export default function UsersRolesPanel() {
  const { can } = useAuth();
  const canCreate = can("user:create");
  const canEdit = can("user:update");

  const [users, setUsers] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<FormMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const [u, r] = await Promise.all([bridge.listUsers(), bridge.listRoles()]);
      setUsers(u);
      setRoles(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roleName = useMemo(() => {
    const byId = new Map(roles.map((r) => [r.id, r.name]));
    return (id: string) => byId.get(id) ?? id;
  }, [roles]);

  const toggleRole = (id: string) =>
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const closeForm = () => {
    setMode(null);
    setEditingId(null);
    setUsername("");
    setDisplayName("");
    setEmail("");
    setPassword("");
    setRoleIds([]);
    setActive(true);
  };

  const startCreate = () => {
    closeForm();
    setMode("create");
  };

  const startEdit = (u: User) => {
    setMode("edit");
    setEditingId(u.id);
    setUsername(u.username);
    setDisplayName(u.displayName);
    setEmail(u.email ?? "");
    setPassword("");
    setRoleIds(u.roleIds);
    setActive(u.active);
  };

  const submit = async () => {
    const bridge = getBridge();
    if (!bridge) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        const result = await bridge.createUser({ username, displayName, email: email || undefined, password, roleIds, active });
        if (!result.ok) {
          setError(result.error);
          return;
        }
      } else if (mode === "edit" && editingId) {
        const result = await bridge.updateUser({ id: editingId, displayName, email: email || undefined, roleIds, active });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (password) {
          const pw = await bridge.setUserPassword(editingId, password);
          if (!pw.ok) {
            setError(pw.error);
            return;
          }
        }
      }
      closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !users) {
    return (
      <section className="placeholder-card">
        <h2>Users &amp; Roles</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!users) {
    return (
      <section className="placeholder-card">
        <h2>Users &amp; Roles</h2>
        <p className="muted">Loading over IPC…</p>
      </section>
    );
  }

  return (
    <>
      {error && <p className="inline-error">{error}</p>}

      {canCreate && (
        <div className="toolbar">
          <button className="primary-btn" onClick={() => (mode ? closeForm() : startCreate())}>
            {mode ? "Close" : "+ New user"}
          </button>
        </div>
      )}

      {mode && (
        <section className="form-card">
          <h2>{mode === "create" ? "New user" : `Edit ${username}`}</h2>
          <div className="form-grid">
            {mode === "create" && (
              <label className="field">
                <span>Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} />
              </label>
            )}
            <label className="field">
              <span>Display name</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label className="field">
              <span>Email (optional)</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>{mode === "create" ? "Password" : "New password (blank = keep)"}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="field">
              <span>Active</span>
              <div className="role-check">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                {active ? "active" : "inactive"}
              </div>
            </label>
            <label className="field field-wide">
              <span>Roles</span>
              <div className="role-checks">
                {roles.map((r) => (
                  <label key={r.id} className="role-check">
                    <input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
                    {r.name}
                  </label>
                ))}
              </div>
            </label>
          </div>
          <div className="form-actions">
            <button className="primary-btn" disabled={busy} onClick={() => void submit()}>
              {busy ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
            </button>
          </div>
        </section>
      )}

      <h3 className="section-title">Users</h3>
      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName}</td>
                <td>{u.username}</td>
                <td>{u.roleIds.map(roleName).join(", ") || "—"}</td>
                <td>
                  <span className={`badge badge-${u.active ? "confirmed" : "cancelled"}`}>
                    {u.active ? "active" : "inactive"}
                  </span>
                </td>
                <td className="actions">
                  {canEdit ? (
                    <button className="action-btn" onClick={() => startEdit(u)}>
                      Edit
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h3 className="section-title">Roles &amp; permissions</h3>
      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Description</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.description || "—"}</td>
                <td>
                  <div className="status-chips">
                    {r.permissions.map((p) => (
                      <span key={p} className="badge">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
