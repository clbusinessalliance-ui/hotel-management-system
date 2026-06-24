import { useCallback, useEffect, useState } from "react";
import type { Reservation, ReservationStatus } from "@shared/types/index.ts";
import { allowedTransitions } from "@core/reservations/index.ts";
import { textMatch } from "@shared/utils/index.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";
import { buildReservationRows, type ReservationRow } from "./reservationRows.ts";
import NewReservationForm from "./NewReservationForm.tsx";
import EditReservationForm from "./EditReservationForm.tsx";

const EDITABLE = new Set<ReservationStatus>(["tentative", "confirmed"]);

/** Button label for each target status. */
const ACTION_LABEL: Record<ReservationStatus, string> = {
  tentative: "Mark tentative",
  confirmed: "Confirm",
  checked_in: "Check in",
  checked_out: "Check out",
  cancelled: "Cancel",
  no_show: "No-show",
};

/**
 * Reservations list with status actions. Reads over IPC and issues the
 * changeReservationStatus command; the allowed actions per row come from the
 * shared reservation state machine, so the UI can never offer an invalid move.
 */
export default function ReservationsPanel() {
  const { can } = useAuth();
  const canWrite = can("reservation:update");
  const [rows, setRows] = useState<ReservationRow[] | null>(null);
  const [raw, setRaw] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const [reservations, guests, rooms] = await Promise.all([
        bridge.listReservations(),
        bridge.listGuests(),
        bridge.listRooms(),
      ]);
      setRaw(reservations);
      setRows(buildReservationRows(reservations, guests, rooms));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (id: string, to: ReservationStatus) => {
      const bridge = getBridge();
      if (!bridge) return;
      setBusyId(id);
      try {
        const result = await bridge.changeReservationStatus(id, to);
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
        <h2>Reservations</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!rows) {
    return (
      <section className="placeholder-card">
        <h2>Reservations</h2>
        <p className="muted">Loading reservations over IPC…</p>
      </section>
    );
  }

  const visible = rows.filter((r) => textMatch([r.guestName, r.roomNumber, r.status], query));

  return (
    <>
      <div className="toolbar toolbar-split">
        <input
          className="search-input"
          placeholder="Search guest, room, status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {canWrite && (
          <button
            className="primary-btn"
            onClick={() => {
              setEditingId(null);
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Close" : "+ New reservation"}
          </button>
        )}
      </div>

      {showForm && (
        <NewReservationForm
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {editingId &&
        (() => {
          const target = raw.find((r) => r.id === editingId);
          return target ? (
            <EditReservationForm
              reservation={target}
              onSaved={async () => {
                setEditingId(null);
                await load();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : null;
        })()}

      {error && <p className="inline-error">{error}</p>}
      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Room</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th className="num">Nights</th>
              <th className="num">Rate / night</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No matching reservations.
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.guestName}</td>
                <td>{r.roomNumber}</td>
                <td>{r.checkIn}</td>
                <td>{r.checkOut}</td>
                <td className="num">{r.nights}</td>
                <td className="num">{r.rateFormatted}</td>
                <td>
                  <span className={`badge badge-${r.status}`}>{r.status.replace(/_/g, " ")}</span>
                </td>
                <td className="actions">
                  {canWrite && EDITABLE.has(r.status) && (
                    <button
                      className="action-btn"
                      disabled={busyId === r.id}
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(r.id);
                      }}
                    >
                      Edit
                    </button>
                  )}
                  {canWrite &&
                    allowedTransitions(r.status).map((to) => (
                      <button
                        key={to}
                        className="action-btn"
                        disabled={busyId === r.id}
                        onClick={() => void act(r.id, to)}
                      >
                        {ACTION_LABEL[to]}
                      </button>
                    ))}
                  {(!canWrite ||
                    (allowedTransitions(r.status).length === 0 && !EDITABLE.has(r.status))) && (
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
