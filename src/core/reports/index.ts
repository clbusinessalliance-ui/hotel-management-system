/**
 * Reports — pure domain calculations over already-loaded data.
 * (Data fetching is the caller's responsibility via repositories.)
 */

import type {
  Invoice,
  Money,
  Reservation,
  ReservationStatus,
  Room,
} from "@shared/types/index.ts";
import type { Payment } from "@shared/types/index.ts";
import { netBalance } from "../billing/index.ts";

/** Occupancy rate = occupied rooms / total rooms, as a 0–1 fraction. */
export function occupancyRate(rooms: Room[]): number {
  if (rooms.length === 0) return 0;
  const occupied = rooms.filter((r) => r.status === "occupied").length;
  return occupied / rooms.length;
}

/** Average length of stay (nights) for a set of reservations. */
export function averageStayNights(reservations: Reservation[]): number {
  if (reservations.length === 0) return 0;
  const totalNights = reservations.reduce((sum, r) => {
    const n = Math.round((Date.parse(r.checkOut) - Date.parse(r.checkIn)) / 86_400_000);
    return sum + Math.max(0, n);
  }, 0);
  return totalNights / reservations.length;
}

export interface RevenueSummary {
  /** Total of non-void invoice amounts. */
  invoiced: Money;
  /** Net cash received (payments minus refunds). */
  collected: Money;
  /** Money guests still owe across open invoices. */
  outstanding: Money;
  /** Money owed back to guests (e.g. voided invoices with payments taken). */
  refundsOwed: Money;
}

/** Aggregate revenue figures from invoices and their payments. */
export function revenueSummary(invoices: Invoice[], payments: Payment[]): RevenueSummary {
  const byInvoice = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = byInvoice.get(p.invoiceId) ?? [];
    list.push(p);
    byInvoice.set(p.invoiceId, list);
  }

  let invoiced = 0;
  let outstanding = 0;
  let refundsOwed = 0;
  for (const inv of invoices) {
    if (inv.status !== "void") invoiced += inv.total;
    const balance = netBalance(inv.total, inv.status, byInvoice.get(inv.id) ?? []);
    if (balance > 0) outstanding += balance;
    else if (balance < 0) refundsOwed += -balance;
  }

  const collected = payments.reduce((sum, p) => sum + p.amount, 0);
  return { invoiced, collected, outstanding, refundsOwed };
}

/** Count reservations by status (every status present, defaulting to 0). */
export function countByStatus(reservations: Reservation[]): Record<ReservationStatus, number> {
  const counts: Record<ReservationStatus, number> = {
    tentative: 0,
    confirmed: 0,
    checked_in: 0,
    checked_out: 0,
    cancelled: 0,
    no_show: 0,
  };
  for (const r of reservations) counts[r.status] += 1;
  return counts;
}

const ACTIVE: ReservationStatus[] = ["tentative", "confirmed", "checked_in", "checked_out"];

/** Active reservations checking in on the given ISO date. */
export function arrivalsOn(reservations: Reservation[], date: string): Reservation[] {
  return reservations.filter((r) => r.checkIn === date && ACTIVE.includes(r.status));
}

/** Active reservations checking out on the given ISO date. */
export function departuresOn(reservations: Reservation[], date: string): Reservation[] {
  return reservations.filter((r) => r.checkOut === date && ACTIVE.includes(r.status));
}
