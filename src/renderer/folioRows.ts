/**
 * Pure presentation helper: builds one reservation-centric guest FOLIO — the
 * stay summary, its invoices, the chronological payment history, and the money
 * position (invoiced / paid / balance due / refund owed). All money math comes
 * from the tested billing core; this is a display projection only — no business
 * logic, no persistence, no mutation of inputs. Framework-free (no React).
 */

import type {
  Guest,
  Invoice,
  Payment,
  Reservation,
  Room,
  RoomType,
} from "@shared/types/index.ts";
import { netBalance, totalPaid } from "@core/billing/index.ts";
import { formatMoney, nightsBetween } from "@shared/utils/index.ts";

export interface FolioInvoiceLine {
  id: string;
  status: Invoice["status"];
  totalMinor: number;
  totalFormatted: string;
}

export interface FolioPaymentLine {
  id: string;
  createdAt: string;
  method: Payment["method"];
  reference: string;
  amountMinor: number;
  amountFormatted: string;
  /** True for refunds (negative payments — money paid back out). */
  isRefund: boolean;
}

export interface Folio {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  typeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  ratePerNightFormatted: string;
  reservationStatus: Reservation["status"];
  currency: string;
  invoices: FolioInvoiceLine[];
  payments: FolioPaymentLine[];
  /** Sum of non-void invoice totals (what the stay was billed). */
  totalInvoicedMinor: number;
  totalInvoicedFormatted: string;
  /** Net cash received (payments minus refunds). */
  totalPaidMinor: number;
  totalPaidFormatted: string;
  /** Money the guest still owes (sum of positive per-invoice net balances). */
  balanceDueMinor: number;
  balanceDueFormatted: string;
  /** Money owed back to the guest (e.g. a voided invoice with payments taken). */
  refundOwedMinor: number;
  refundOwedFormatted: string;
}

export interface FolioSources {
  reservations: Reservation[];
  invoices: Invoice[];
  payments: Payment[];
  guests: Guest[];
  rooms: Room[];
  roomTypes: RoomType[];
}

/** Build the folio for one reservation, or null when the reservation is unknown. */
export function buildFolio(reservationId: string, sources: FolioSources): Folio | null {
  const reservation = sources.reservations.find((r) => r.id === reservationId);
  if (!reservation) return null;

  const guest = sources.guests.find((g) => g.id === reservation.guestId);
  const room = reservation.roomId
    ? sources.rooms.find((r) => r.id === reservation.roomId)
    : undefined;
  const type = room ? sources.roomTypes.find((t) => t.id === room.roomTypeId) : undefined;
  const currency = reservation.currency;

  const stayInvoices = sources.invoices.filter((inv) => inv.reservationId === reservationId);
  const invoiceIds = new Set(stayInvoices.map((inv) => inv.id));
  // Copy before sorting — inputs are never mutated. ISO timestamps sort lexically.
  const stayPayments = sources.payments
    .filter((p) => invoiceIds.has(p.invoiceId))
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Per-invoice signed positions, split like the reports core's revenueSummary:
  // positive nets accumulate as balance due, negative nets as refund owed.
  let totalInvoiced = 0;
  let balanceDue = 0;
  let refundOwed = 0;
  for (const inv of stayInvoices) {
    if (inv.status !== "void") totalInvoiced += inv.total;
    const invoicePayments = stayPayments.filter((p) => p.invoiceId === inv.id);
    const net = netBalance(inv.total, inv.status, invoicePayments);
    if (net > 0) balanceDue += net;
    else if (net < 0) refundOwed += -net;
  }
  const paid = totalPaid(stayPayments);

  return {
    reservationId,
    guestName: guest ? `${guest.firstName} ${guest.lastName}` : "Unknown guest",
    roomNumber: room ? room.number : "—",
    typeName: type ? type.name : "—",
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    nights: nightsBetween(reservation.checkIn, reservation.checkOut),
    ratePerNightFormatted: formatMoney(reservation.ratePerNight, currency),
    reservationStatus: reservation.status,
    currency,
    invoices: stayInvoices.map((inv) => ({
      id: inv.id,
      status: inv.status,
      totalMinor: inv.total,
      totalFormatted: formatMoney(inv.total, inv.currency),
    })),
    payments: stayPayments.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      method: p.method,
      reference: p.reference ?? "",
      amountMinor: p.amount,
      amountFormatted: formatMoney(Math.abs(p.amount), currency),
      isRefund: p.amount < 0,
    })),
    totalInvoicedMinor: totalInvoiced,
    totalInvoicedFormatted: formatMoney(totalInvoiced, currency),
    totalPaidMinor: paid,
    totalPaidFormatted: formatMoney(paid, currency),
    balanceDueMinor: balanceDue,
    balanceDueFormatted: formatMoney(balanceDue, currency),
    refundOwedMinor: refundOwed,
    refundOwedFormatted: formatMoney(refundOwed, currency),
  };
}
