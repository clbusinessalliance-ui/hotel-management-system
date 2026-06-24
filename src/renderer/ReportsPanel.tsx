import { useCallback, useEffect, useState } from "react";
import type { ReservationStatus } from "@shared/types/index.ts";
import {
  occupancyRate,
  averageStayNights,
  revenueSummary,
  countByStatus,
  arrivalsOn,
  departuresOn,
  type RevenueSummary,
} from "@core/reports/index.ts";
import { formatMoney } from "@shared/utils/index.ts";
import { getBridge } from "./pmsClient.ts";
import { buildReservationRows, type ReservationRow } from "./reservationRows.ts";

interface ReportData {
  occupancyPct: number;
  occupied: number;
  totalRooms: number;
  avgStay: number;
  revenue: RevenueSummary;
  counts: Record<ReservationStatus, number>;
  arrivals: ReservationRow[];
  departures: ReservationRow[];
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Read-only Reports screen. Pulls rooms / reservations / invoices / payments /
 * guests over the existing IPC read channels and computes figures with the
 * tested reports core. No new backend surface.
 */
export default function ReportsPanel() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge) {
      setError("Desktop bridge unavailable — run the desktop app (npm start) to see live data.");
      return;
    }
    try {
      const [rooms, reservations, invoices, payments, guests] = await Promise.all([
        bridge.listRooms(),
        bridge.listReservations(),
        bridge.listInvoices(),
        bridge.listPayments(),
        bridge.listGuests(),
      ]);
      const rows = buildReservationRows(reservations, guests, rooms);
      const rowById = new Map(rows.map((r) => [r.id, r]));
      const toRows = (list: { id: string }[]) =>
        list.map((r) => rowById.get(r.id)).filter((r): r is ReservationRow => r != null);

      setData({
        occupancyPct: Math.round(occupancyRate(rooms) * 100),
        occupied: rooms.filter((r) => r.status === "occupied").length,
        totalRooms: rooms.length,
        avgStay: averageStayNights(reservations),
        revenue: revenueSummary(invoices, payments),
        counts: countByStatus(reservations),
        arrivals: toRows(arrivalsOn(reservations, today())),
        departures: toRows(departuresOn(reservations, today())),
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <section className="placeholder-card">
        <h2>Reports</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="placeholder-card">
        <h2>Reports</h2>
        <p className="muted">Crunching the numbers over IPC…</p>
      </section>
    );
  }

  const cards: Array<[string, string, string?]> = [
    ["Occupancy", `${data.occupancyPct}%`, `${data.occupied}/${data.totalRooms} rooms`],
    ["Avg stay", data.avgStay.toFixed(1), "nights"],
    ["Invoiced", formatMoney(data.revenue.invoiced)],
    ["Collected", formatMoney(data.revenue.collected)],
    ["Outstanding", formatMoney(data.revenue.outstanding)],
    ["Refunds owed", formatMoney(data.revenue.refundsOwed)],
  ];

  const statusEntries = Object.entries(data.counts) as Array<[ReservationStatus, number]>;

  return (
    <div className="reports">
      <div className="stat-grid">
        {cards.map(([label, value, sub]) => (
          <div className="stat" key={label}>
            <div className="stat-value">{value}</div>
            <div className="stat-label">
              {label}
              {sub ? ` · ${sub}` : ""}
            </div>
          </div>
        ))}
      </div>

      <section className="placeholder-card" style={{ marginTop: 20 }}>
        <h2>Reservations by status</h2>
        <div className="status-chips">
          {statusEntries.map(([status, count]) => (
            <span key={status} className={`badge badge-${status}`}>
              {status.replace(/_/g, " ")}: {count}
            </span>
          ))}
        </div>
      </section>

      <div className="report-cols">
        <section className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Today&apos;s arrivals</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {data.arrivals.length === 0 ? (
                <tr>
                  <td colSpan={2} className="muted">
                    None
                  </td>
                </tr>
              ) : (
                data.arrivals.map((r) => (
                  <tr key={r.id}>
                    <td>{r.guestName}</td>
                    <td>{r.roomNumber}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Today&apos;s departures</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {data.departures.length === 0 ? (
                <tr>
                  <td colSpan={2} className="muted">
                    None
                  </td>
                </tr>
              ) : (
                data.departures.map((r) => (
                  <tr key={r.id}>
                    <td>{r.guestName}</td>
                    <td>{r.roomNumber}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
