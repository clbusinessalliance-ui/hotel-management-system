import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Guest, Reservation, Room, RoomType } from "@shared/types/index.ts";
import { buildRoomBoardRows, type RoomBoardRow } from "./roomBoardRows.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";

/** Local calendar date (YYYY-MM-DD) for "today" — front-desk operations are local. */
function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** One room card. Display only; the optional `action` is a reused command button. */
function RoomCard({ row, action }: { row: RoomBoardRow; action?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-value">{row.roomNumber}</div>
      <div className="stat-label">{row.typeName}</div>
      {row.occupantName && <div className="muted">{row.occupantName}</div>}
      <div className="status-chips">
        <span className={`badge badge-${row.roomStatus}`}>{row.roomStatus.replace(/_/g, " ")}</span>
        {row.arrivalToday && <span className="badge badge-confirmed">Arrival</span>}
        {row.departureToday && <span className="badge badge-checked_out">Departure</span>}
      </div>
      {action && <div className="actions">{action}</div>}
    </div>
  );
}

function Section({ title, rows, renderAction }: {
  title: string;
  rows: RoomBoardRow[];
  renderAction?: (row: RoomBoardRow) => ReactNode;
}) {
  return (
    <>
      <h2 className="section-title">
        {title} <span className="muted">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="muted">None.</p>
      ) : (
        <div className="stat-grid">
          {rows.map((row) => (
            <RoomCard key={row.roomId} row={row} action={renderAction?.(row)} />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Front Desk — today's operational board. Read-only projection over existing IPC
 * reads (rooms, room types, reservations, guests) via the pure
 * `buildRoomBoardRows` helper. The only writes are check-in / check-out, issued
 * through the existing `changeReservationStatus` command — no new IPC, no new
 * business logic. Write controls are gated by the existing permission system.
 */
export default function FrontDeskPanel() {
  const { can } = useAuth();
  const canWrite = can("reservation:update");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const [r, rt, res, g] = await Promise.all([
        bridge.listRooms(),
        bridge.listRoomTypes(),
        bridge.listReservations(),
        bridge.listGuests(),
      ]);
      setRooms(r);
      setRoomTypes(rt);
      setReservations(res);
      setGuests(g);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (reservationId: string, to: "checked_in" | "checked_out") => {
      const bridge = getBridge();
      if (!bridge) return;
      setBusyId(reservationId);
      try {
        const result = await bridge.changeReservationStatus(reservationId, to);
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

  const today = localToday();
  const rows = useMemo(
    () => buildRoomBoardRows(rooms, roomTypes, reservations, guests, today),
    [rooms, roomTypes, reservations, guests, today]
  );

  const arrivals = rows.filter((r) => r.arrivalToday);
  const inHouse = rows.filter((r) => r.currentReservationId);
  const departures = rows.filter((r) => r.departureToday);
  const available = rows.filter((r) => r.roomStatus === "available");
  const outOfService = rows.filter((r) => r.roomStatus === "out_of_service");

  const checkInBtn = (row: RoomBoardRow): ReactNode =>
    canWrite && row.todayReservationId ? (
      <button
        className="action-btn"
        disabled={busyId === row.todayReservationId}
        onClick={() => void act(row.todayReservationId!, "checked_in")}
      >
        Check in
      </button>
    ) : null;

  const checkOutBtn = (row: RoomBoardRow): ReactNode =>
    canWrite && row.currentReservationId ? (
      <button
        className="action-btn"
        disabled={busyId === row.currentReservationId}
        onClick={() => void act(row.currentReservationId!, "checked_out")}
      >
        Check out
      </button>
    ) : null;

  if (error && !loaded) {
    return (
      <section className="placeholder-card">
        <h2>Front Desk</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!loaded) {
    return (
      <section className="placeholder-card">
        <h2>Front Desk</h2>
        <p className="muted">Loading today's board over IPC…</p>
      </section>
    );
  }

  return (
    <>
      {error && <p className="inline-error">{error}</p>}
      <Section title="Today's Arrivals" rows={arrivals} renderAction={checkInBtn} />
      <Section title="In House" rows={inHouse} renderAction={checkOutBtn} />
      <Section title="Today's Departures" rows={departures} renderAction={checkOutBtn} />
      <Section title="Available Rooms" rows={available} />
      <Section title="Out of Service" rows={outOfService} />
    </>
  );
}
