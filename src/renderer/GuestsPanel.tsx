import { useCallback, useEffect, useState } from "react";
import type { Guest } from "@shared/types/index.ts";
import { textMatch } from "@shared/utils/index.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";

interface Draft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
}

/**
 * Guests list with inline editing. Reads over the typed IPC bridge; an Edit
 * action turns a row into inputs and saves via the updateGuest command.
 */
export default function GuestsPanel() {
  const { can } = useAuth();
  const canWrite = can("guest:update");
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const g = await bridge.listGuests();
      setGuests([...g].sort((a, b) => a.lastName.localeCompare(b.lastName)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (g: Guest) => {
    setEditingId(g.id);
    setDraft({
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email ?? "",
      phone: g.phone ?? "",
      nationality: g.nationality ?? "",
    });
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(null);
  };

  const save = async () => {
    const bridge = getBridge();
    if (!bridge || !editingId || !draft) return;
    setBusy(true);
    try {
      const result = await bridge.updateGuest({ id: editingId, ...draft });
      if (!result.ok) setError(result.error);
      else {
        cancel();
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setField = (k: keyof Draft, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  if (error && !guests) {
    return (
      <section className="placeholder-card">
        <h2>Guests</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!guests) {
    return (
      <section className="placeholder-card">
        <h2>Guests</h2>
        <p className="muted">Loading guests over IPC…</p>
      </section>
    );
  }

  const visible = guests.filter((g) =>
    textMatch([g.firstName, g.lastName, g.email, g.phone, g.nationality], query)
  );

  return (
    <>
      {error && <p className="inline-error">{error}</p>}
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search name, email, phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Nationality</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No matching guests.
                </td>
              </tr>
            )}
            {visible.map((g) =>
              editingId === g.id && draft ? (
                <tr key={g.id}>
                  <td>
                    <div className="pay-form">
                      <input
                        className="pay-input"
                        placeholder="First"
                        value={draft.firstName}
                        onChange={(e) => setField("firstName", e.target.value)}
                      />
                      <input
                        className="pay-input"
                        placeholder="Last"
                        value={draft.lastName}
                        onChange={(e) => setField("lastName", e.target.value)}
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      className="pay-input"
                      value={draft.email}
                      onChange={(e) => setField("email", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="pay-input"
                      value={draft.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="pay-input"
                      value={draft.nationality}
                      onChange={(e) => setField("nationality", e.target.value)}
                    />
                  </td>
                  <td className="actions">
                    <button className="action-btn" disabled={busy} onClick={() => void save()}>
                      Save
                    </button>
                    <button className="action-btn" disabled={busy} onClick={cancel}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={g.id}>
                  <td>
                    {g.firstName} {g.lastName}
                  </td>
                  <td>{g.email ?? "—"}</td>
                  <td>{g.phone ?? "—"}</td>
                  <td>{g.nationality ?? "—"}</td>
                  <td className="actions">
                    {canWrite ? (
                      <button className="action-btn" onClick={() => startEdit(g)}>
                        Edit
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
