import { useCallback, useEffect, useState } from "react";
import type { RoomStatus } from "@shared/types/index.ts";
import { allowedRoomStatuses } from "@core/rooms/index.ts";
import { textMatch } from "@shared/utils/index.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";
import { buildRoomRows, type RoomRow } from "./roomRows.ts";

/** Button label for each target room status. */
const ACTION_LABEL: Record<RoomStatus, string> = {
  available: "Make available",
  occupied: "Mark occupied",
  dirty: "Mark dirty",
  out_of_service: "Out of service",
};

/**
 * Rooms list with status actions. Reads over IPC and issues the changeRoomStatus
 * command; allowed actions per row come from the shared room status machine, so
 * the UI can never offer an invalid move. Display + guarded writes only.
 */
export default function RoomsPanel() {
  const { can } = useAuth();
  const canWrite = can("room:update");
  const [rows, setRows] = useState<RoomRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const [rooms, roomTypes] = await Promise.all([bridge.listRooms(), bridge.listRoomTypes()]);
      setRows(buildRoomRows(rooms, roomTypes));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (id: string, to: RoomStatus) => {
      const bridge = getBridge();
      if (!bridge) return;
      setBusyId(id);
      try {
        const result = await bridge.changeRoomStatus(id, to);
        if (!result.ok) setError(result.error);
        else await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  if (error && !rows) {
    return (
      <section className="placeholder-card">
        <h2>Rooms</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!rows) {
    return (
      <section className="placeholder-card">
        <h2>Rooms</h2>
        <p className="muted">Loading rooms over IPC…</p>
      </section>
    );
  }

  const visible = rows.filter((r) => textMatch([r.number, r.typeName, r.status, r.floor], query));

  return (
    <>
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search room, type, status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error && <p className="inline-error">{error}</p>}
      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Floor</th>
              <th>Type</th>
              <th className="num">Base price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No matching rooms.
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.number}</td>
                <td>{r.floor}</td>
                <td>{r.typeName}</td>
                <td className="num">{r.basePriceFormatted}</td>
                <td>
                  <span className={`badge badge-${r.status}`}>{r.status.replace(/_/g, " ")}</span>
                </td>
                <td className="actions">
                  {canWrite ? (
                    allowedRoomStatuses(r.status).map((to) => (
                      <button
                        key={to}
                        className="action-btn"
                        disabled={busyId === r.id}
                        onClick={() => void act(r.id, to)}
                      >
                        {ACTION_LABEL[to]}
                      </button>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
