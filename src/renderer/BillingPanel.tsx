import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Guest,
  Invoice,
  Payment,
  PaymentMethod,
  Reservation,
  Room,
  RoomType,
} from "@shared/types/index.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";
import { buildBillingRows, type BillingRow } from "./billingRows.ts";
import { buildFolio, type Folio } from "./folioRows.ts";

const METHODS: PaymentMethod[] = ["cash", "card", "transfer", "other"];

/** Inline form to record a payment against one invoice (amount entered in major units). */
function PaymentForm({ invoiceId, onDone }: { invoiceId: string; onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const bridge = getBridge();
    if (!bridge) return;
    const major = Number(amount);
    if (!Number.isFinite(major) || major <= 0) {
      setError("Enter a positive amount");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const minor = Math.round(major * 100);
      const result = await bridge.recordPayment(invoiceId, minor, method);
      if (!result.ok) setError(result.error);
      else {
        setAmount("");
        await onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pay-form">
      <input
        className="pay-input"
        type="number"
        min="0"
        step="0.01"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <select
        className="pay-select"
        value={method}
        onChange={(e) => setMethod(e.target.value as PaymentMethod)}
      >
        {METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <button className="action-btn" disabled={busy} onClick={() => void submit()}>
        Record
      </button>
      {error && <span className="pay-error">{error}</span>}
    </div>
  );
}

/**
 * Guest folio detail. Renders the buildFolio() projection verbatim — every
 * figure comes from the helper; nothing is recalculated here.
 */
function FolioView({ folio, onClose }: { folio: Folio; onClose: () => void }) {
  return (
    <>
      <div className="toolbar toolbar-split">
        <h2 className="section-title">Guest Folio — {folio.guestName}</h2>
        <button className="action-btn" onClick={onClose}>
          Close folio
        </button>
      </div>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Room</th>
              <th>Type</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th className="num">Nights</th>
              <th className="num">Rate / night</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{folio.guestName}</td>
              <td>{folio.roomNumber}</td>
              <td>{folio.typeName}</td>
              <td>{folio.checkIn}</td>
              <td>{folio.checkOut}</td>
              <td className="num">{folio.nights}</td>
              <td className="num">{folio.ratePerNightFormatted}</td>
              <td>
                <span className={`badge badge-${folio.reservationStatus}`}>
                  {folio.reservationStatus.replace(/_/g, " ")}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <h2 className="section-title">Invoices</h2>
      {folio.invoices.length === 0 ? (
        <p className="muted">No invoices.</p>
      ) : (
        <section className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Status</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {folio.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <code>{inv.id}</code>
                  </td>
                  <td>
                    <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                  </td>
                  <td className="num">{inv.totalFormatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <h2 className="section-title">Payment history</h2>
      {folio.payments.length === 0 ? (
        <p className="muted">No payments recorded.</p>
      ) : (
        <section className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Reference</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {folio.payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.createdAt.slice(0, 10)}</td>
                  <td>{p.method}</td>
                  <td>{p.reference || "—"}</td>
                  <td className={"num" + (p.isRefund ? " refund" : "")}>
                    {p.isRefund ? `Refund ${p.amountFormatted}` : p.amountFormatted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <h2 className="section-title">Totals</h2>
      <section className="table-card">
        <table className="data-table">
          <tbody>
            <tr>
              <td>Total invoiced</td>
              <td className="num">{folio.totalInvoicedFormatted}</td>
            </tr>
            <tr>
              <td>Total paid</td>
              <td className="num">{folio.totalPaidFormatted}</td>
            </tr>
            <tr>
              <td>Balance due</td>
              <td className="num">{folio.balanceDueFormatted}</td>
            </tr>
            <tr>
              <td>Refund owed</td>
              <td className={"num" + (folio.refundOwedMinor > 0 ? " refund" : "")}>
                {folio.refundOwedFormatted}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

/**
 * Billing list with a record-payment action per open invoice, plus an inline
 * guest folio per invoice. Reads over the typed IPC bridge; writes go through
 * the recordPayment / recordRefund commands. Money math (paid / balance /
 * folio totals) comes from the tested billing core via buildBillingRows and
 * buildFolio — never recalculated here.
 */
export default function BillingPanel() {
  const { can } = useAuth();
  const canWrite = can("billing:update");
  const [rows, setRows] = useState<BillingRow[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Reservation whose folio is open (null = none selected). */
  const [folioFor, setFolioFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const [inv, pay, res, gst, rms, types] = await Promise.all([
        bridge.listInvoices(),
        bridge.listPayments(),
        bridge.listReservations(),
        bridge.listGuests(),
        bridge.listRooms(),
        bridge.listRoomTypes(),
      ]);
      setInvoices(inv);
      setPayments(pay);
      setReservations(res);
      setGuests(gst);
      setRooms(rms);
      setRoomTypes(types);
      setRows(buildBillingRows(inv, pay, res, gst));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refund = useCallback(
    async (invoiceId: string) => {
      const bridge = getBridge();
      if (!bridge) return;
      setBusyId(invoiceId);
      try {
        const result = await bridge.recordRefund(invoiceId);
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

  /** Map an invoice to its reservation and open that folio (pure lookup, no math). */
  const openFolio = useCallback(
    (invoiceId: string) => {
      const invoice = invoices.find((inv) => inv.id === invoiceId);
      setFolioFor(invoice ? invoice.reservationId : null);
    },
    [invoices]
  );

  const folio = useMemo(
    () =>
      folioFor
        ? buildFolio(folioFor, { reservations, invoices, payments, guests, rooms, roomTypes })
        : null,
    [folioFor, reservations, invoices, payments, guests, rooms, roomTypes]
  );

  if (error && !rows) {
    return (
      <section className="placeholder-card">
        <h2>Billing</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!rows) {
    return (
      <section className="placeholder-card">
        <h2>Billing</h2>
        <p className="muted">Loading invoices over IPC…</p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="placeholder-card">
        <h2>Billing</h2>
        <p className="muted">No invoices yet.</p>
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
              <th>Guest</th>
              <th className="num">Total</th>
              <th className="num">Paid</th>
              <th className="num">Balance</th>
              <th>Status</th>
              <th>Folio</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.guestName}</td>
                <td className="num">{r.totalFormatted}</td>
                <td className="num">{r.paidFormatted}</td>
                <td className={"num" + (r.balanceMinor < 0 ? " refund" : "")}>
                  {r.balanceFormatted}
                </td>
                <td>
                  <span className={`badge badge-${r.status}`}>{r.status}</span>
                </td>
                <td>
                  <button className="action-btn" onClick={() => openFolio(r.id)}>
                    Folio
                  </button>
                </td>
                <td>
                  {!canWrite ? (
                    <span className="muted">—</span>
                  ) : r.status === "open" && r.balanceMinor > 0 ? (
                    <PaymentForm invoiceId={r.id} onDone={load} />
                  ) : r.balanceMinor < 0 ? (
                    <button
                      className="action-btn"
                      disabled={busyId === r.id}
                      onClick={() => void refund(r.id)}
                    >
                      Mark refunded
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {folioFor && !folio && (
        <p className="muted">No folio available — the reservation for this invoice was not found.</p>
      )}
      {folio && <FolioView folio={folio} onClose={() => setFolioFor(null)} />}
    </>
  );
}
