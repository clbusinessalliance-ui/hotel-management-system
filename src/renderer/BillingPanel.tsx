import { useCallback, useEffect, useState } from "react";
import type { PaymentMethod } from "@shared/types/index.ts";
import { getBridge } from "./pmsClient.ts";
import { useAuth } from "./authContext.tsx";
import { buildBillingRows, type BillingRow } from "./billingRows.ts";

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
 * Billing list with a record-payment action per open invoice. Reads over the
 * typed IPC bridge; writes go through the recordPayment command. Money math
 * (paid / balance) comes from the tested billing core.
 */
export default function BillingPanel() {
  const { can } = useAuth();
  const canWrite = can("billing:update");
  const [rows, setRows] = useState<BillingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const [invoices, payments, reservations, guests] = await Promise.all([
        bridge.listInvoices(),
        bridge.listPayments(),
        bridge.listReservations(),
        bridge.listGuests(),
      ]);
      setRows(buildBillingRows(invoices, payments, reservations, guests));
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
    </>
  );
}
