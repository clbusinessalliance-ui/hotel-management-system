import { useCallback, useEffect, useState } from "react";
import type { HousekeepingStatus } from "@shared/types/index.ts";
import { allowedHousekeepingStatuses } from "@core/housekeeping/index.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";
import { buildHousekeepingRows, type HousekeepingRow } from "./housekeepingRows.ts";

/** Button label for each target housekeeping status. */
const ACTION_LABEL: Record<HousekeepingStatus, string> = {
  pending: "Reset",
  in_progress: "Start",
  done: "Mark done",
  inspected: "Mark inspected",
};

/**
 * Housekeeping task list with status actions. Reads over IPC and issues the
 * advanceHousekeepingTask command; allowed actions per row come from the shared
 * task flow, so the UI can never offer an invalid move.
 */
export default function HousekeepingPanel() {
  const { can } = useAuth();
  const canWrite = can("housekeeping:update");
  const [rows, setRows] = useState<HousekeepingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const [tasks, rooms] = await Promise.all([bridge.listHousekeeping(), bridge.listRooms()]);
      setRows(buildHousekeepingRows(tasks, rooms));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (id: string, to: HousekeepingStatus) => {
      const bridge = getBridge();
      if (!bridge) return;
      setBusyId(id);
      try {
        const result = await bridge.advanceHousekeepingTask(id, to);
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
        <h2>Housekeeping</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!rows) {
    return (
      <section className="placeholder-card">
        <h2>Housekeeping</h2>
        <p className="muted">Loading tasks over IPC…</p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="placeholder-card">
        <h2>Housekeeping</h2>
        <p className="muted">No housekeeping tasks.</p>
      </section>
    );
  }

  return (
    <>
      {error && <p className="inline-error">{error}</p>}
      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Scheduled</th>
              <th>Assigned to</th>
              <th>Notes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.roomNumber}</td>
                <td>{r.scheduledFor}</td>
                <td>{r.assignedTo}</td>
                <td>{r.notes || "—"}</td>
                <td>
                  <span className={`badge badge-${r.status}`}>{r.status.replace(/_/g, " ")}</span>
                </td>
                <td className="actions">
                  {canWrite &&
                    allowedHousekeepingStatuses(r.status).map((to) => (
                      <button
                        key={to}
                        className="action-btn"
                        disabled={busyId === r.id}
                        onClick={() => void act(r.id, to)}
                      >
                        {ACTION_LABEL[to]}
                      </button>
                    ))}
                  {(!canWrite || allowedHousekeepingStatuses(r.status).length === 0) && (
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
