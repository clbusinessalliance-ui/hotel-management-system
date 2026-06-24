import { useCallback, useEffect, useState } from "react";
import type { AccessEvent, AccessKeyRecord, KeyMedium } from "@shared/types/index.ts";
import { getBridge } from "./pmsClient.ts";
import { buildReservationRows, type ReservationRow } from "./reservationRows.ts";

const ACTIVE = new Set(["tentative", "confirmed", "checked_in"]);

/**
 * Access engine demo. Issues a brand-neutral door key (PIN or card) for a booking
 * through whatever DoorProvider is wired in (today: the Noop stub — no real lock
 * vendor). The credential secret is stored ENCRYPTED at rest and only revealed on
 * demand for authorized staff.
 */
export default function AccessPanel() {
  const [provider, setProvider] = useState<string>("");
  const [options, setOptions] = useState<ReservationRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [medium, setMedium] = useState<KeyMedium>("pin");
  const [records, setRecords] = useState<AccessKeyRecord[]>([]);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [roomLabel, setRoomLabel] = useState<Map<string, string>>(new Map());
  const [guestName, setGuestName] = useState<Map<string, string>>(new Map());
  const [issuedPin, setIssuedPin] = useState<{ pin: string; where: string; medium: KeyMedium } | null>(null);
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to use the access engine.");
      return;
    }
    try {
      const [info, reservations, guests, rooms, keys, evts] = await Promise.all([
        bridge.getInfo(),
        bridge.listReservations(),
        bridge.listGuests(),
        bridge.listRooms(),
        bridge.listAccessKeys(),
        bridge.listAccessEvents(),
      ]);
      setEvents([...evts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setProvider(info.doorProvider);
      setRoomLabel(new Map(rooms.map((r) => [r.id, r.number])));
      setGuestName(new Map(guests.map((g) => [g.id, `${g.firstName} ${g.lastName}`])));
      const rows = buildReservationRows(reservations, guests, rooms).filter(
        (r) => r.roomNumber !== "—" && ACTIVE.has(r.status)
      );
      setOptions(rows);
      setSelectedId((prev) => prev || rows[0]?.id || "");
      setRecords([...keys].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const issue = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge || !selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.issueRoomKey(selectedId, medium);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIssuedPin({
        pin: result.value.secret,
        where: roomLabel.get(result.value.doorId) ?? result.value.doorId,
        medium: result.value.medium,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [selectedId, medium, roomLabel, load]);

  const reveal = useCallback(async (keyId: string) => {
    const bridge = getBridge();
    if (!bridge) return;
    try {
      const result = await bridge.revealKeySecret(keyId);
      if (!result.ok) setError(result.error);
      else setRevealed((prev) => new Map(prev).set(keyId, result.value));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const revoke = useCallback(
    async (keyId: string) => {
      const bridge = getBridge();
      if (!bridge) return;
      try {
        const result = await bridge.revokeRoomKey(keyId);
        if (!result.ok) setError(result.error);
        else await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [load]
  );

  if (error && options.length === 0 && records.length === 0) {
    return (
      <section className="placeholder-card">
        <h2>Access</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  const fmt = (iso: string) => iso.slice(0, 16).replace("T", " ");

  return (
    <>
      {error && <p className="inline-error">{error}</p>}

      <section className="form-card">
        <h2>Issue a room key</h2>
        <p className="muted">
          Door provider: <code>{provider || "…"}</code> — brand-neutral; a real lock vendor would
          drop in here as an adapter with no change to this screen.
        </p>
        <div className="pay-form">
          <select
            className="pay-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ minWidth: 320 }}
          >
            {options.length === 0 && <option value="">No active bookings with a room</option>}
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {r.guestName} — Room {r.roomNumber} ({r.checkIn} → {r.checkOut})
              </option>
            ))}
          </select>
          <select className="pay-select" value={medium} onChange={(e) => setMedium(e.target.value as KeyMedium)}>
            <option value="pin">PIN</option>
            <option value="card">Card</option>
          </select>
          <button className="primary-btn" disabled={busy || !selectedId} onClick={() => void issue()}>
            {busy ? "Issuing…" : "Issue key"}
          </button>
        </div>
        {issuedPin && (
          <p className="pin-banner">
            🔑 {issuedPin.medium === "card" ? "Card" : "PIN"} issued for {issuedPin.where} —{" "}
            <code>{issuedPin.pin}</code> (shown once; stored encrypted — reveal below if needed)
          </p>
        )}
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Holder</th>
              <th>Room</th>
              <th>Medium</th>
              <th>Secret</th>
              <th>Valid until</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No keys issued yet.
                </td>
              </tr>
            ) : (
              records.map((k) => (
                <tr key={k.id}>
                  <td>{guestName.get(k.holderId) ?? k.holderId}</td>
                  <td>{k.roomId ? roomLabel.get(k.roomId) ?? k.roomId : "—"}</td>
                  <td>{k.medium}</td>
                  <td>
                    {revealed.has(k.id) ? (
                      <code>{revealed.get(k.id)}</code>
                    ) : (
                      <button className="action-btn" onClick={() => void reveal(k.id)}>
                        Reveal
                      </button>
                    )}
                  </td>
                  <td>{fmt(k.validUntil)}</td>
                  <td>
                    <span className={`badge badge-${k.revoked ? "cancelled" : "confirmed"}`}>
                      {k.revoked ? "revoked" : "active"}
                    </span>
                  </td>
                  <td>
                    {k.revoked ? (
                      <span className="muted">—</span>
                    ) : (
                      <button className="action-btn" onClick={() => void revoke(k.id)}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <h3 className="section-title">Recent activity</h3>
      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Room</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No access activity yet.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id}>
                  <td>{fmt(e.createdAt)}</td>
                  <td>
                    <span className={`badge badge-${e.action === "revoked" ? "cancelled" : "confirmed"}`}>
                      {e.action}
                    </span>
                  </td>
                  <td>{e.roomId ? roomLabel.get(e.roomId) ?? e.roomId : "—"}</td>
                  <td>{e.detail ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
