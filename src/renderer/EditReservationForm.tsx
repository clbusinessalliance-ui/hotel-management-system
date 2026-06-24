import { useEffect, useMemo, useState } from "react";
import type { Reservation, Room, RoomType } from "@shared/types/index.ts";
import { getBridge } from "./pmsClient.ts";

/**
 * Edit an upcoming reservation's room, dates, and notes. Guest is fixed.
 * Availability and invoice recompute are enforced server-side by updateReservation.
 */
export default function EditReservationForm({
  reservation,
  onSaved,
  onCancel,
}: {
  reservation: Reservation;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [roomId, setRoomId] = useState(reservation.roomId ?? "");
  const [checkIn, setCheckIn] = useState(reservation.checkIn);
  const [checkOut, setCheckOut] = useState(reservation.checkOut);
  const [notes, setNotes] = useState(reservation.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;
    Promise.all([bridge.listRooms(), bridge.listRoomTypes()])
      .then(([r, t]) => {
        setRooms(r);
        setRoomTypes(t);
        if (!reservation.roomId && r[0]) setRoomId(r[0].id);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [reservation.roomId]);

  const typeName = useMemo(() => {
    const byId = new Map(roomTypes.map((t) => [t.id, t.name]));
    return (id: string) => byId.get(id) ?? "—";
  }, [roomTypes]);

  const submit = async () => {
    const bridge = getBridge();
    if (!bridge) return;
    if (!roomId) {
      setError("Select a room");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.updateReservation({
        reservationId: reservation.id,
        roomId,
        checkIn,
        checkOut,
        notes: notes || undefined,
      });
      if (!result.ok) setError(result.error);
      else await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="form-card">
      <h2>Edit reservation</h2>
      {error && <p className="inline-error">{error}</p>}
      <div className="form-grid">
        <label className="field">
          <span>Room</span>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number} — {typeName(r.roomTypeId)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Check-in</span>
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>
        <label className="field">
          <span>Check-out</span>
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </label>
        <label className="field field-wide">
          <span>Notes (optional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-btn" disabled={busy} onClick={() => void submit()}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button className="action-btn" disabled={busy} onClick={onCancel} style={{ marginLeft: 8 }}>
          Cancel
        </button>
      </div>
    </section>
  );
}
