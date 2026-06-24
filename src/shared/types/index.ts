/**
 * Shared domain types used across PMS modules.
 *
 * These are intentionally framework-free (no React, Electron, or vendor types)
 * so they can travel from the desktop core to a future cloud API unchanged.
 */

export type ID = string;
export type ISODateString = string; // e.g. "2026-06-12"
export type ISODateTimeString = string; // e.g. "2026-06-12T14:30:00Z"

/** Minor currency unit (e.g. cents) to avoid floating-point money bugs. */
export type Money = number;
export type CurrencyCode = string; // ISO 4217, e.g. "USD"

export interface Audited {
  id: ID;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

// ── Auth / Users / Roles ────────────────────────────────────────────────
export type RoleName = "owner" | "manager" | "front_desk" | "housekeeping" | "accountant";

export interface User extends Audited {
  username: string;
  displayName: string;
  email?: string;
  roleIds: ID[];
  active: boolean;
}

export interface Role extends Audited {
  name: RoleName;
  description: string;
  permissions: string[]; // e.g. "reservation:create"
}

// ── Property / Rooms ────────────────────────────────────────────────────
export interface Property extends Audited {
  name: string;
  type: "hotel" | "guesthouse";
  address?: string;
  timezone: string;
  currency: CurrencyCode;
}

export interface RoomType extends Audited {
  propertyId: ID;
  code: string;
  name: string;
  basePrice: Money;
  maxOccupancy: number;
}

export type RoomStatus = "available" | "occupied" | "dirty" | "out_of_service";

export interface Room extends Audited {
  propertyId: ID;
  roomTypeId: ID;
  number: string;
  floor?: string;
  status: RoomStatus;
}

// ── Guests ──────────────────────────────────────────────────────────────
export interface Guest extends Audited {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  documentId?: string;
  nationality?: string;
}

// ── Reservations ────────────────────────────────────────────────────────
export type ReservationStatus =
  | "tentative"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export interface Reservation extends Audited {
  propertyId: ID;
  guestId: ID;
  roomId?: ID;
  roomTypeId: ID;
  checkIn: ISODateString;
  checkOut: ISODateString;
  status: ReservationStatus;
  ratePerNight: Money;
  currency: CurrencyCode;
  notes?: string;
}

// ── Billing / Payments ──────────────────────────────────────────────────
export type InvoiceStatus = "open" | "paid" | "void";
export type PaymentMethod = "cash" | "card" | "transfer" | "other";

export interface Invoice extends Audited {
  reservationId: ID;
  status: InvoiceStatus;
  currency: CurrencyCode;
  total: Money;
}

export interface InvoiceItem extends Audited {
  invoiceId: ID;
  description: string;
  quantity: number;
  unitPrice: Money;
}

export interface Payment extends Audited {
  invoiceId: ID;
  method: PaymentMethod;
  amount: Money;
  reference?: string;
}

// ── Housekeeping ────────────────────────────────────────────────────────
export type HousekeepingStatus = "pending" | "in_progress" | "done" | "inspected";

export interface HousekeepingTask extends Audited {
  roomId: ID;
  assignedTo?: ID;
  status: HousekeepingStatus;
  scheduledFor: ISODateString;
  notes?: string;
}

// ── Access (door keys) ──────────────────────────────────────────────────
// Plain, vendor-neutral credential DTOs. Live here (not in the access layer) so
// the shared IPC contract can reference them without importing access code.
export type KeyMedium = "pin" | "card" | "mobile" | "virtual";

export interface DoorKey {
  id: ID;
  doorId: ID;
  holderId: ID;
  medium: KeyMedium;
  /** PIN code, card token, or mobile key reference — meaning depends on `medium`. */
  secret: string;
  validFrom: ISODateTimeString;
  validUntil: ISODateTimeString;
  revoked: boolean;
}

/**
 * A persisted record of an issued door key. Deliberately omits the `secret` —
 * the PIN/credential is a one-time reveal at issue time and is owned by the
 * provider, not stored by the PMS.
 */
export interface AccessKeyRecord {
  id: ID;
  roomId?: ID;
  holderId: ID;
  provider: string;
  medium: KeyMedium;
  validFrom: ISODateTimeString;
  validUntil: ISODateTimeString;
  revoked: boolean;
  createdAt: ISODateTimeString;
}

/** An audit-trail entry for a door access action (issued / revoked). */
export interface AccessEvent {
  id: ID;
  keyId?: ID;
  roomId?: ID;
  action: "issued" | "revoked";
  detail?: string;
  createdAt: ISODateTimeString;
}

/** Generic result envelope used by use cases. */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
