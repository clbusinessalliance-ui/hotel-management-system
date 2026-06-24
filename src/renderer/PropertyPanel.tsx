import { useCallback, useEffect, useMemo, useState } from "react";
import type { Property, Room, RoomType } from "@shared/types/index.ts";
import { formatMoney } from "@shared/utils/index.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";

/**
 * Property management: view property details and grow inventory by adding room
 * types and rooms. Reads + guarded creates over the typed IPC bridge.
 */
export default function PropertyPanel() {
  const { can } = useAuth();
  const canWrite = can("property:update");
  const [property, setProperty] = useState<Property | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Property details edit
  const [editingProp, setEditingProp] = useState(false);
  const [pName, setPName] = useState("");
  const [pType, setPType] = useState<Property["type"]>("guesthouse");
  const [pAddress, setPAddress] = useState("");
  const [pTimezone, setPTimezone] = useState("");
  const [pCurrency, setPCurrency] = useState("");

  // Add-room-type form
  const [rtCode, setRtCode] = useState("");
  const [rtName, setRtName] = useState("");
  const [rtPrice, setRtPrice] = useState("");
  const [rtMaxOcc, setRtMaxOcc] = useState("2");

  // Add-room form
  const [rNumber, setRNumber] = useState("");
  const [rFloor, setRFloor] = useState("");
  const [rTypeId, setRTypeId] = useState("");

  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const [props, types, rms] = await Promise.all([
        bridge.listProperties(),
        bridge.listRoomTypes(),
        bridge.listRooms(),
      ]);
      setProperty(props[0] ?? null);
      setRoomTypes(types);
      setRooms(rms);
      setRTypeId((prev) => prev || types[0]?.id || "");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEditProp = () => {
    if (!property) return;
    setPName(property.name);
    setPType(property.type);
    setPAddress(property.address ?? "");
    setPTimezone(property.timezone);
    setPCurrency(property.currency);
    setEditingProp(true);
  };

  const saveProp = async () => {
    const bridge = getBridge();
    if (!bridge || !property) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.updateProperty({
        id: property.id,
        name: pName,
        type: pType,
        address: pAddress || undefined,
        timezone: pTimezone,
        currency: pCurrency,
      });
      if (!result.ok) setError(result.error);
      else {
        setEditingProp(false);
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const typeName = useMemo(() => {
    const byId = new Map(roomTypes.map((t) => [t.id, t.name]));
    return (id: string) => byId.get(id) ?? "—";
  }, [roomTypes]);

  const addRoomType = async () => {
    const bridge = getBridge();
    if (!bridge) return;
    const price = Number(rtPrice);
    const occ = Number(rtMaxOcc);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid base price");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.createRoomType({
        code: rtCode,
        name: rtName,
        basePrice: Math.round(price * 100),
        maxOccupancy: Math.max(1, Math.round(occ)),
      });
      if (!result.ok) setError(result.error);
      else {
        setRtCode("");
        setRtName("");
        setRtPrice("");
        setRtMaxOcc("2");
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addRoom = async () => {
    const bridge = getBridge();
    if (!bridge) return;
    if (!rTypeId) {
      setError("Select a room type");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.createRoom({
        number: rNumber,
        floor: rFloor || undefined,
        roomTypeId: rTypeId,
      });
      if (!result.ok) setError(result.error);
      else {
        setRNumber("");
        setRFloor("");
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !property && roomTypes.length === 0) {
    return (
      <section className="placeholder-card">
        <h2>Property</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  return (
    <>
      {error && <p className="inline-error">{error}</p>}

      <section className="form-card">
        {!editingProp ? (
          <>
            <h2>{property ? property.name : "No property"}</h2>
            {property && (
              <p className="muted">
                {property.type} · {property.address ?? "no address"} · {property.timezone} ·{" "}
                {property.currency}
              </p>
            )}
            {property && canWrite && (
              <div className="form-actions">
                <button className="action-btn" onClick={startEditProp}>
                  Edit details
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <h2>Edit property</h2>
            <div className="form-grid">
              <label className="field">
                <span>Name</span>
                <input value={pName} onChange={(e) => setPName(e.target.value)} />
              </label>
              <label className="field">
                <span>Type</span>
                <select value={pType} onChange={(e) => setPType(e.target.value as Property["type"])}>
                  <option value="hotel">hotel</option>
                  <option value="guesthouse">guesthouse</option>
                </select>
              </label>
              <label className="field">
                <span>Address</span>
                <input value={pAddress} onChange={(e) => setPAddress(e.target.value)} />
              </label>
              <label className="field">
                <span>Timezone</span>
                <input value={pTimezone} onChange={(e) => setPTimezone(e.target.value)} />
              </label>
              <label className="field">
                <span>Currency (ISO)</span>
                <input value={pCurrency} onChange={(e) => setPCurrency(e.target.value)} />
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-btn" disabled={busy} onClick={() => void saveProp()}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                className="action-btn"
                disabled={busy}
                onClick={() => setEditingProp(false)}
                style={{ marginLeft: 8 }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </section>

      <h3 className="section-title">Room types</h3>
      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th className="num">Base price</th>
              <th className="num">Max occupancy</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((t) => (
              <tr key={t.id}>
                <td>{t.code}</td>
                <td>{t.name}</td>
                <td className="num">{formatMoney(t.basePrice)}</td>
                <td className="num">{t.maxOccupancy}</td>
              </tr>
            ))}
            {canWrite && (
              <tr>
                <td>
                  <input className="pay-input" placeholder="Code" value={rtCode} onChange={(e) => setRtCode(e.target.value)} />
                </td>
                <td>
                  <input className="pay-input" placeholder="Name" value={rtName} onChange={(e) => setRtName(e.target.value)} />
                </td>
                <td className="num">
                  <input className="pay-input" type="number" min="0" step="0.01" placeholder="0.00" value={rtPrice} onChange={(e) => setRtPrice(e.target.value)} />
                </td>
                <td className="num">
                  <input className="pay-input" type="number" min="1" value={rtMaxOcc} onChange={(e) => setRtMaxOcc(e.target.value)} style={{ width: 60 }} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canWrite && (
          <div className="form-actions">
            <button className="primary-btn" disabled={busy} onClick={() => void addRoomType()}>
              Add room type
            </button>
          </div>
        )}
      </section>

      <h3 className="section-title">Rooms</h3>
      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Floor</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td>{r.number}</td>
                <td>{r.floor ?? "—"}</td>
                <td>{typeName(r.roomTypeId)}</td>
              </tr>
            ))}
            {canWrite && (
              <tr>
                <td>
                  <input className="pay-input" placeholder="Number" value={rNumber} onChange={(e) => setRNumber(e.target.value)} />
                </td>
                <td>
                  <input className="pay-input" placeholder="Floor" value={rFloor} onChange={(e) => setRFloor(e.target.value)} />
                </td>
                <td>
                  <select className="pay-select" value={rTypeId} onChange={(e) => setRTypeId(e.target.value)}>
                    {roomTypes.length === 0 && <option value="">Add a room type first</option>}
                    {roomTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canWrite && (
          <div className="form-actions">
            <button className="primary-btn" disabled={busy || roomTypes.length === 0} onClick={() => void addRoom()}>
              Add room
            </button>
          </div>
        )}
      </section>
    </>
  );
}
