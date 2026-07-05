import { useCallback, useEffect, useState } from "react";
import type { HousekeepingStatus } from "@shared/types/index.ts";
import { allowedHousekeepingStatuses } from "@core/housekeeping/index.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";
import {
  buildHousekeepingRows,
  groupHousekeepingRows,
  type HousekeepingRow,
} from "./housekeepingRows.ts";

/** Button label for each target housekeeping status. */
const ACTION_LABEL: Record<HousekeepingStatus, string> = {
  pending: "Reset",
  in_progress: "Start",
  done: "Mark done",
  inspected: "Mark inspected",
};

/** Local calendar date (YYYY-MM-DD) for "today" — operations are local. */
function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Housekeeping operations dashboard. Tasks are grouped into the four working
 * buckets (pending → in progress → done → inspected today) via the pure
 * groupHousekeepingRows projection. Reads over IPC only; status actions reuse
 * the existing advanceHousekeepingTask command, with allowed moves coming from
 * the shared task flow so the UI can never offer an invalid transition.
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
      const [tasks, rooms, roomTypes, users] = await Promise.all([
        bridge.listHousekeeping(),
        bridge.listRooms(),
        bridge.listRoomTypes(),
        bridge.listUsers(),
      ]);
      setRows(buildHousekeepingRows(tasks, rooms, roomTypes, users));
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

  /** One bucket of the dashboard: a titled table of tasks (or a muted "None."). */
  const renderSection = (title: string, sectionRows: HousekeepingRow[]) => (
    <>
      <h2 className="section-title">
        {title} <span className="muted">({sectionRows.length})</span>
      </h2>
      {sectionRows.length === 0 ? (
        <p className="muted">None.</p>
      ) : (
        <section className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th>Scheduled</th>
                <th>Assigned to</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sectionRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.roomNumber}</td>
                  <td>{r.typeName}</td>
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
      )}
    </>
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

  const board = groupHousekeepingRows(rows, localToday());

  return (
    <>
      {error && <p className="inline-error">{error}</p>}
      {renderSection("Pending", board.pending)}
      {renderSection("In Progress", board.inProgress)}
      {renderSection("Done / Ready for Inspection", board.done)}
      {renderSection("Inspected / Completed Today", board.inspectedToday)}
    </>
  );
}
