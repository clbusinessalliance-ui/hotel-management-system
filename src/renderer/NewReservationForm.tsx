import { useEffect, useMemo, useState } from "react";
import type { Guest, Room, RoomType } from "@shared/types/index.ts";
import { getBridge } from "./pmsClient.ts";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Create-reservation form. Supports picking an existing guest or creating a new
 * one inline; on submit it creates the guest (if needed) then the reservation.
 * Date inputs are native pickers. Availability is enforced server-side.
 */
export default function NewReservationForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  const [guestMode, setGuestMode] = useState<"existing" | "new">("existing");
  const [guestId, setGuestId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [roomId, setRoomId] = useState("");
  const [checkIn, setCheckIn] = useState(todayPlus(0));
  const [checkOut, setCheckOut] = useState(todayPlus(1));
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app to create reservations.");
      return;
    }
    Promise.all([bridge.listGuests(), bridge.listRooms(), bridge.listRoomTypes()])
      .then(([g, r, t]) => {
        setGuests(g);
        setRooms(r);
        setRoomTypes(t);
        if (g[0]) setGuestId(g[0].id);
        if (r[0]) setRoomId(r[0].id);
        if (g.length === 0) setGuestMode("new");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

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
      let resolvedGuestId = guestId;
      if (guestMode === "new") {
        const created = await bridge.createGuest({ firstName, lastName, email: email || undefined });
        if (!created.ok) {
          setError(created.error);
          return;
        }
        resolvedGuestId = created.value.id;
      }
      if (!resolvedGuestId) {
        setError("Select or create a guest");
        return;
      }

      const result = await bridge.createReservation({
        guestId: resolvedGuestId,
        roomId,
        checkIn,
        checkOut,
        notes: notes || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="form-card">
      <h2>New reservation</h2>
      {error && <p className="inline-error">{error}</p>}

      <div className="form-grid">
        <label className="field">
          <span>Guest</span>
          <div className="guest-toggle">
            <button
              type="button"
              className={"toggle-btn" + (guestMode === "existing" ? " active" : "")}
              onClick={() => setGuestMode("existing")}
              disabled={guests.length === 0}
            >
              Existing
            </button>
            <button
              type="button"
              className={"toggle-btn" + (guestMode === "new" ? " active" : "")}
              onClick={() => setGuestMode("new")}
            >
              New guest
            </button>
          </div>
        </label>

        {guestMode === "existing" ? (
          <label className="field">
            <span>Select guest</span>
            <select value={guestId} onChange={(e) => setGuestId(e.target.value)}>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.firstName} {g.lastName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="field">
              <span>First name</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="field">
              <span>Last name</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <label className="field">
              <span>Email (optional)</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </>
        )}

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
          {busy ? "Creating…" : "Create reservation"}
        </button>
      </div>
    </section>
  );
}
