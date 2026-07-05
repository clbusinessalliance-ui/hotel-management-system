/**
 * PMS command use-cases (writes).
 *
 * Commands mutate state. They are kept separate from the read-only `queries.ts`
 * surface. Each command loads through a repository port, applies an already-tested
 * pure domain rule, stamps bookkeeping fields, and persists — no new business
 * logic lives here. Depends only on `PmsCore` (repository ports), never on a
 * concrete database or Electron.
 */

import type { PmsCore } from "./index.ts";
import type {
  DoorKey,
  Guest,
  HousekeepingStatus,
  KeyMedium,
  HousekeepingTask,
  Invoice,
  Payment,
  PaymentMethod,
  Property,
  Reservation,
  ReservationStatus,
  Result,
  Room,
  RoomStatus,
  RoomType,
  User,
} from "@shared/types/index.ts";
import type {
  CreateGuestInput,
  CreateReservationInput,
  CreateRoomInput,
  CreateRoomTypeInput,
  CreateUserInput,
  UpdateGuestInput,
  UpdatePropertyInput,
  UpdateReservationInput,
  UpdateUserInput,
} from "@shared/ipc/contract.ts";
import { changeStatus, findRoomConflict, quoteReservation } from "../reservations/index.ts";
import { setRoomStatus } from "../rooms/index.ts";
import { advanceTask } from "../housekeeping/index.ts";
import { balanceDue, netBalance } from "../billing/index.ts";
import { validateGuest } from "../guests/index.ts";
import { validateProperty } from "../property/index.ts";
import { nightsBetween, newId, nowISO } from "@shared/utils/index.ts";

/**
 * Move a reservation to a new status, guarded by the reservation state machine.
 * Returns an error Result for unknown ids or disallowed transitions.
 */
export async function changeReservationStatus(
  pms: PmsCore,
  reservationId: string,
  to: ReservationStatus
): Promise<Result<Reservation>> {
  const existing = await pms.data.reservations.getById(reservationId);
  if (!existing) {
    return { ok: false, error: `Reservation ${reservationId} not found` };
  }

  const transition = changeStatus(existing, to);
  if (!transition.ok) return transition;

  const updated: Reservation = { ...transition.value, updatedAt: new Date().toISOString() };
  await pms.data.reservations.save(updated);

  // Keep the room's status in step with the stay lifecycle, reusing the existing
  // changeRoomStatus command so the room state machine stays authoritative. This
  // is best-effort: an impossible transition (e.g. the room is already occupied)
  // is a harmless no-op, never an error that would undo the reservation change.
  // Only check-in / check-out drive the room; cancelled / no_show / tentative /
  // confirmed intentionally leave the room untouched.
  if (updated.roomId) {
    if (to === "checked_in") {
      await changeRoomStatus(pms, updated.roomId, "occupied");
    } else if (to === "checked_out") {
      await changeRoomStatus(pms, updated.roomId, "dirty");

      // Auto-create the turnover cleaning task for the vacated room — unless an
      // open task (pending / in_progress) already exists for it. One task per
      // room, never duplicates. Unassigned; staff assignment is a later concern.
      const hasOpenTask = (await pms.data.housekeeping.list()).some(
        (t) =>
          t.roomId === updated.roomId && (t.status === "pending" || t.status === "in_progress")
      );
      if (!hasOpenTask) {
        const stamp = nowISO();
        const task: HousekeepingTask = {
          id: newId("hk"),
          roomId: updated.roomId,
          assignedTo: undefined,
          status: "pending",
          scheduledFor: stamp.slice(0, 10), // today
          notes: "Automatically created after guest checkout",
          createdAt: stamp,
          updatedAt: stamp,
        };
        await pms.data.housekeeping.save(task);
      }
    }
  }

  // Cancellation policy: void any outstanding invoices for the reservation.
  // Payments already taken then surface as a refund owed (negative net balance).
  if (to === "cancelled") {
    const invoices = (await pms.data.invoices.list()).filter(
      (inv) => inv.reservationId === reservationId && inv.status !== "void"
    );
    for (const inv of invoices) {
      await pms.data.invoices.save({ ...inv, status: "void", updatedAt: nowISO() });
    }
  }

  return { ok: true, value: updated };
}

/**
 * Move a room to a new status, guarded by the room status machine.
 * Returns an error Result for unknown ids or disallowed transitions.
 */
export async function changeRoomStatus(
  pms: PmsCore,
  roomId: string,
  to: RoomStatus
): Promise<Result<Room>> {
  const existing = await pms.data.rooms.getById(roomId);
  if (!existing) {
    return { ok: false, error: `Room ${roomId} not found` };
  }

  const transition = setRoomStatus(existing, to);
  if (!transition.ok) return transition;

  const updated: Room = { ...transition.value, updatedAt: new Date().toISOString() };
  await pms.data.rooms.save(updated);
  return { ok: true, value: updated };
}

/**
 * Advance a housekeeping task to a new status, guarded by the task flow.
 * Returns an error Result for unknown ids or disallowed transitions.
 */
export async function advanceHousekeepingTask(
  pms: PmsCore,
  taskId: string,
  to: HousekeepingStatus
): Promise<Result<HousekeepingTask>> {
  const existing = await pms.data.housekeeping.getById(taskId);
  if (!existing) {
    return { ok: false, error: `Housekeeping task ${taskId} not found` };
  }

  const transition = advanceTask(existing, to);
  if (!transition.ok) return transition;

  const updated: HousekeepingTask = { ...transition.value, updatedAt: new Date().toISOString() };
  await pms.data.housekeeping.save(updated);

  // Release the room back into service once its clean passes inspection —
  // reusing changeRoomStatus so the room state machine stays authoritative.
  // Best-effort: an impossible transition or a missing room is a harmless
  // no-op, never an error that would undo the task change. The task flow only
  // reaches "inspected" from "done", so this fires exactly once per clean.
  if (to === "inspected") {
    await changeRoomStatus(pms, updated.roomId, "available");
  }

  return { ok: true, value: updated };
}

/**
 * Record a payment against an invoice (amount in minor units). Rejects unknown
 * or void invoices and non-positive amounts. If the payment clears the balance,
 * the invoice is marked paid (using the tested billing math).
 */
export async function recordPayment(
  pms: PmsCore,
  invoiceId: string,
  amount: number,
  method: PaymentMethod,
  reference?: string
): Promise<Result<Payment>> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Payment amount must be a positive whole number of minor units" };
  }

  const invoice = await pms.data.invoices.getById(invoiceId);
  if (!invoice) return { ok: false, error: `Invoice ${invoiceId} not found` };
  if (invoice.status === "void") {
    return { ok: false, error: "Cannot record a payment on a void invoice" };
  }

  const now = nowISO();
  const payment: Payment = {
    id: newId("pay"),
    invoiceId,
    method,
    amount,
    reference,
    createdAt: now,
    updatedAt: now,
  };
  await pms.data.payments.save(payment);

  // Mark the invoice settled once its balance is cleared.
  const invoicePayments = (await pms.data.payments.list()).filter((p) => p.invoiceId === invoiceId);
  if (invoice.status === "open" && balanceDue(invoice.total, invoicePayments) === 0) {
    await pms.data.invoices.save({ ...invoice, status: "paid", updatedAt: nowISO() });
  }

  return { ok: true, value: payment };
}

/**
 * Record that a refund owed on an invoice has been paid out (e.g. after a
 * cancellation voided it). Modelled as a negative payment so the existing
 * `netBalance` / `totalPaid` math clears the refund to zero. Rejects invoices
 * that have no refund owed.
 */
export async function recordRefund(pms: PmsCore, invoiceId: string): Promise<Result<Payment>> {
  const invoice = await pms.data.invoices.getById(invoiceId);
  if (!invoice) return { ok: false, error: `Invoice ${invoiceId} not found` };

  const invoicePayments = (await pms.data.payments.list()).filter((p) => p.invoiceId === invoiceId);
  const balance = netBalance(invoice.total, invoice.status, invoicePayments);
  if (balance >= 0) {
    return { ok: false, error: "No refund is owed on this invoice" };
  }

  const now = nowISO();
  const refund: Payment = {
    id: newId("pay"),
    invoiceId,
    method: "other",
    amount: balance, // negative: money paid back out, clears the owed refund
    reference: "Refund",
    createdAt: now,
    updatedAt: now,
  };
  await pms.data.payments.save(refund);
  return { ok: true, value: refund };
}

/**
 * Authenticate a user. The verifier + hasher are injected (Node crypto lives
 * outside the pure core). On success with a legacy hash, the password is rehashed
 * to the current scheme. Returns the user on success; a generic error otherwise.
 */
export async function login(
  pms: PmsCore,
  username: string,
  password: string,
  verify: (plain: string, stored: string) => { valid: boolean; needsUpgrade: boolean },
  hash: (plain: string) => string
): Promise<Result<User>> {
  const creds = await pms.data.users.findCredentials(username.trim());
  if (!creds) return { ok: false, error: "Invalid username or password" };
  if (!creds.user.active) return { ok: false, error: "Account is inactive" };

  const { valid, needsUpgrade } = verify(password, creds.passwordHash);
  if (!valid) return { ok: false, error: "Invalid username or password" };

  // Transparently upgrade a legacy hash to the current scheme after a good login.
  if (needsUpgrade) await pms.data.users.setPasswordHash(creds.user.id, hash(password));

  return { ok: true, value: creds.user };
}

/** Create a staff user with a password and roles. Hasher injected (Node infra). */
export async function createUser(
  pms: PmsCore,
  input: CreateUserInput,
  hash: (plain: string) => string
): Promise<Result<User>> {
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  if (!username || !displayName) return { ok: false, error: "Username and display name are required" };
  if (!input.password) return { ok: false, error: "Password is required" };

  if (await pms.data.users.findByUsername(username)) {
    return { ok: false, error: `Username "${username}" already exists` };
  }

  const now = nowISO();
  const user: User = {
    id: newId("user"),
    username,
    displayName,
    email: input.email && input.email.trim() ? input.email.trim() : undefined,
    roleIds: input.roleIds,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  };
  await pms.data.users.save(user);
  await pms.data.users.setPasswordHash(user.id, hash(input.password));
  return { ok: true, value: user };
}

/** Update an existing user's profile, roles, and active flag (username is immutable). */
export async function updateUser(pms: PmsCore, input: UpdateUserInput): Promise<Result<User>> {
  const existing = await pms.data.users.getById(input.id);
  if (!existing) return { ok: false, error: `User ${input.id} not found` };

  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "Display name is required" };

  const updated: User = {
    ...existing,
    displayName,
    email: input.email && input.email.trim() ? input.email.trim() : undefined,
    roleIds: input.roleIds,
    active: input.active,
    updatedAt: nowISO(),
  };
  await pms.data.users.save(updated);
  return { ok: true, value: updated };
}

/** Set a user's password (hasher injected). */
export async function setUserPassword(
  pms: PmsCore,
  userId: string,
  password: string,
  hash: (plain: string) => string
): Promise<Result<true>> {
  if (!password) return { ok: false, error: "Password is required" };
  const existing = await pms.data.users.getById(userId);
  if (!existing) return { ok: false, error: `User ${userId} not found` };
  await pms.data.users.setPasswordHash(userId, hash(password));
  return { ok: true, value: true };
}

/** Update the property's details, validated by the property domain rules. */
export async function updateProperty(
  pms: PmsCore,
  input: UpdatePropertyInput
): Promise<Result<Property>> {
  const existing = await pms.data.properties.getById(input.id);
  if (!existing) return { ok: false, error: `Property ${input.id} not found` };

  const currency = input.currency.trim().toUpperCase();
  const errors = validateProperty({ name: input.name, currency, timezone: input.timezone });
  if (errors.length > 0) return { ok: false, error: errors.join("; ") };

  const updated: Property = {
    ...existing,
    name: input.name.trim(),
    type: input.type,
    address: input.address && input.address.trim() ? input.address.trim() : undefined,
    timezone: input.timezone.trim(),
    currency,
    updatedAt: nowISO(),
  };
  await pms.data.properties.save(updated);
  return { ok: true, value: updated };
}

/** Create a room type under the (single) property. Rejects duplicate codes. */
export async function createRoomType(
  pms: PmsCore,
  input: CreateRoomTypeInput
): Promise<Result<RoomType>> {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { ok: false, error: "Code and name are required" };
  if (!Number.isInteger(input.basePrice) || input.basePrice < 0) {
    return { ok: false, error: "Base price must be a non-negative whole number of minor units" };
  }
  if (!Number.isInteger(input.maxOccupancy) || input.maxOccupancy < 1) {
    return { ok: false, error: "Max occupancy must be at least 1" };
  }

  const property = (await pms.data.properties.list())[0];
  if (!property) return { ok: false, error: "No property configured" };

  const existing = await pms.data.roomTypes.list();
  if (existing.some((t) => t.propertyId === property.id && t.code.toLowerCase() === code.toLowerCase())) {
    return { ok: false, error: `Room type code "${code}" already exists` };
  }

  const now = nowISO();
  const roomType: RoomType = {
    id: newId("rt"),
    propertyId: property.id,
    code,
    name,
    basePrice: input.basePrice,
    maxOccupancy: input.maxOccupancy,
    createdAt: now,
    updatedAt: now,
  };
  await pms.data.roomTypes.save(roomType);
  return { ok: true, value: roomType };
}

/** Create a room of a given type. Rejects duplicate room numbers within the property. */
export async function createRoom(pms: PmsCore, input: CreateRoomInput): Promise<Result<Room>> {
  const number = input.number.trim();
  if (!number) return { ok: false, error: "Room number is required" };

  const roomType = await pms.data.roomTypes.getById(input.roomTypeId);
  if (!roomType) return { ok: false, error: "Select a valid room type" };

  const existing = await pms.data.rooms.list();
  if (existing.some((r) => r.propertyId === roomType.propertyId && r.number.toLowerCase() === number.toLowerCase())) {
    return { ok: false, error: `Room ${number} already exists` };
  }

  const now = nowISO();
  const room: Room = {
    id: newId("room"),
    propertyId: roomType.propertyId,
    roomTypeId: roomType.id,
    number,
    floor: input.floor && input.floor.trim() ? input.floor.trim() : undefined,
    status: "available",
    createdAt: now,
    updatedAt: now,
  };
  await pms.data.rooms.save(room);
  return { ok: true, value: room };
}

/** Create a new guest, validated by the guest domain rules. */
export async function createGuest(pms: PmsCore, input: CreateGuestInput): Promise<Result<Guest>> {
  const errors = validateGuest(input);
  if (errors.length > 0) return { ok: false, error: errors.join("; ") };

  const now = nowISO();
  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  const guest: Guest = {
    id: newId("guest"),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: clean(input.email),
    phone: clean(input.phone),
    documentId: clean(input.documentId),
    nationality: clean(input.nationality),
    createdAt: now,
    updatedAt: now,
  };
  await pms.data.guests.save(guest);
  return { ok: true, value: guest };
}

/** Update an existing guest's details. Preserves fields not in the input (e.g. documentId). */
export async function updateGuest(pms: PmsCore, input: UpdateGuestInput): Promise<Result<Guest>> {
  const existing = await pms.data.guests.getById(input.id);
  if (!existing) return { ok: false, error: `Guest ${input.id} not found` };

  const errors = validateGuest(input);
  if (errors.length > 0) return { ok: false, error: errors.join("; ") };

  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  const updated: Guest = {
    ...existing,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: clean(input.email),
    phone: clean(input.phone),
    nationality: clean(input.nationality),
    updatedAt: nowISO(),
  };
  await pms.data.guests.save(updated);
  return { ok: true, value: updated };
}

/**
 * Create a reservation for a room and date range. Rejects unknown room/guest,
 * invalid dates, and — the core availability rule — any room that already has an
 * overlapping reservation. Rate and currency are derived from the room's type
 * and property.
 */
export async function createReservation(
  pms: PmsCore,
  input: CreateReservationInput
): Promise<Result<Reservation>> {
  const room = await pms.data.rooms.getById(input.roomId);
  if (!room) return { ok: false, error: `Room ${input.roomId} not found` };

  const guest = await pms.data.guests.getById(input.guestId);
  if (!guest) return { ok: false, error: `Guest ${input.guestId} not found` };

  if (Number.isNaN(Date.parse(input.checkIn)) || Number.isNaN(Date.parse(input.checkOut))) {
    return { ok: false, error: "Check-in and check-out must be valid dates" };
  }
  if (nightsBetween(input.checkIn, input.checkOut) <= 0) {
    return { ok: false, error: "Stay must be at least one night" };
  }

  const existing = await pms.data.reservations.list();
  if (findRoomConflict(input.roomId, input.checkIn, input.checkOut, existing)) {
    return { ok: false, error: `Room ${room.number} is not available for those dates` };
  }

  const property = await pms.data.properties.getById(room.propertyId);
  const roomType = await pms.data.roomTypes.getById(room.roomTypeId);
  const now = nowISO();
  const reservation: Reservation = {
    id: newId("resv"),
    propertyId: room.propertyId,
    guestId: input.guestId,
    roomId: input.roomId,
    roomTypeId: room.roomTypeId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    status: "confirmed",
    ratePerNight: roomType?.basePrice ?? 0,
    currency: property?.currency ?? "USD",
    notes: input.notes && input.notes.trim() ? input.notes.trim() : undefined,
    createdAt: now,
    updatedAt: now,
  };
  await pms.data.reservations.save(reservation);

  // A booking generates its folio: an open invoice for the full stay
  // (nights × nightly rate). This is what surfaces on the Billing screen.
  const invoice: Invoice = {
    id: newId("inv"),
    reservationId: reservation.id,
    status: "open",
    currency: reservation.currency,
    total: quoteReservation(input.checkIn, input.checkOut, reservation.ratePerNight).subtotal,
    createdAt: now,
    updatedAt: now,
  };
  await pms.data.invoices.save(invoice);

  return { ok: true, value: reservation };
}

const EDITABLE_STATUSES: ReservationStatus[] = ["tentative", "confirmed"];

/**
 * Update an upcoming reservation's room, dates, or notes. Re-checks availability
 * (excluding itself) and, when the linked invoice is still open with no payments,
 * recomputes its total to match the new stay. Only tentative/confirmed bookings
 * may be edited.
 */
export async function updateReservation(
  pms: PmsCore,
  input: UpdateReservationInput
): Promise<Result<Reservation>> {
  const existing = await pms.data.reservations.getById(input.reservationId);
  if (!existing) return { ok: false, error: `Reservation ${input.reservationId} not found` };
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    return { ok: false, error: "Only upcoming (tentative/confirmed) reservations can be edited" };
  }

  const room = await pms.data.rooms.getById(input.roomId);
  if (!room) return { ok: false, error: `Room ${input.roomId} not found` };

  if (Number.isNaN(Date.parse(input.checkIn)) || Number.isNaN(Date.parse(input.checkOut))) {
    return { ok: false, error: "Check-in and check-out must be valid dates" };
  }
  if (nightsBetween(input.checkIn, input.checkOut) <= 0) {
    return { ok: false, error: "Stay must be at least one night" };
  }

  const all = await pms.data.reservations.list();
  if (findRoomConflict(input.roomId, input.checkIn, input.checkOut, all, existing.id)) {
    return { ok: false, error: `Room ${room.number} is not available for those dates` };
  }

  const property = await pms.data.properties.getById(room.propertyId);
  const roomType = await pms.data.roomTypes.getById(room.roomTypeId);
  const updated: Reservation = {
    ...existing,
    propertyId: room.propertyId,
    roomId: input.roomId,
    roomTypeId: room.roomTypeId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    ratePerNight: roomType?.basePrice ?? existing.ratePerNight,
    currency: property?.currency ?? existing.currency,
    notes: input.notes && input.notes.trim() ? input.notes.trim() : undefined,
    updatedAt: nowISO(),
  };
  await pms.data.reservations.save(updated);

  // Keep the folio in sync: recompute an open invoice that has no payments yet.
  const payments = await pms.data.payments.list();
  const openInvoices = (await pms.data.invoices.list()).filter(
    (inv) => inv.reservationId === existing.id && inv.status === "open"
  );
  for (const inv of openInvoices) {
    const hasPayments = payments.some((p) => p.invoiceId === inv.id);
    if (!hasPayments) {
      const total = quoteReservation(input.checkIn, input.checkOut, updated.ratePerNight).subtotal;
      await pms.data.invoices.save({ ...inv, total, updatedAt: nowISO() });
    }
  }

  return { ok: true, value: updated };
}

/**
 * Issue a door key (PIN or card) for a reservation's room and stay window, via the
 * brand-neutral Access Engine. The credential secret is stored ENCRYPTED at rest
 * (encrypt injected — Node infra); the plaintext is returned once for display.
 */
export async function issueRoomKey(
  pms: PmsCore,
  reservationId: string,
  medium: KeyMedium,
  encrypt: (plain: string) => string
): Promise<Result<DoorKey>> {
  const reservation = await pms.data.reservations.getById(reservationId);
  if (!reservation) return { ok: false, error: `Reservation ${reservationId} not found` };
  if (!reservation.roomId) {
    return { ok: false, error: "Reservation has no room assigned" };
  }

  const room = await pms.data.rooms.getById(reservation.roomId);
  const guest = await pms.data.guests.getById(reservation.guestId);
  const result = await pms.access.issueStayKey({
    door: { id: reservation.roomId, label: room ? `Room ${room.number}` : undefined },
    holderId: reservation.guestId,
    validFrom: `${reservation.checkIn}T14:00:00.000Z`, // check-in time
    validUntil: `${reservation.checkOut}T11:00:00.000Z`, // check-out time
    medium,
  });
  if (!result.ok) return result;

  const key = result.value;
  const now = nowISO();
  await pms.data.accessKeys.save({
    id: key.id,
    roomId: reservation.roomId,
    holderId: key.holderId,
    provider: pms.access.providerName,
    medium: key.medium,
    validFrom: key.validFrom,
    validUntil: key.validUntil,
    revoked: key.revoked,
    createdAt: now,
  });
  // Store the credential secret encrypted at rest (revealable only on demand).
  await pms.data.accessKeys.setSecret(key.id, encrypt(key.secret));

  // Audit trail.
  await pms.data.accessEvents.save({
    id: newId("evt"),
    keyId: key.id,
    roomId: reservation.roomId,
    action: "issued",
    detail: guest ? `${guest.firstName} ${guest.lastName}` : reservation.guestId,
    createdAt: now,
  });

  return result;
}

/**
 * Reveal a stored key's credential secret by decrypting it (decrypt injected).
 * Used when staff need the PIN/card token again after the one-time issue display.
 */
export async function revealKeySecret(
  pms: PmsCore,
  keyId: string,
  decrypt: (cipher: string) => string
): Promise<Result<string>> {
  const ciphertext = await pms.data.accessKeys.getSecret(keyId);
  if (!ciphertext) return { ok: false, error: "No secret stored for this key" };
  try {
    return { ok: true, value: decrypt(ciphertext) };
  } catch {
    return { ok: false, error: "Could not decrypt the stored secret" };
  }
}

/** Revoke a previously issued door key through the Access Engine, and persist it. */
export async function revokeRoomKey(pms: PmsCore, keyId: string): Promise<Result<true>> {
  const result = await pms.access.revokeKey(keyId);
  if (!result.ok) return result;

  const record = await pms.data.accessKeys.getById(keyId);
  if (record) await pms.data.accessKeys.save({ ...record, revoked: true });

  await pms.data.accessEvents.save({
    id: newId("evt"),
    keyId,
    roomId: record?.roomId,
    action: "revoked",
    createdAt: nowISO(),
  });

  return result;
}
