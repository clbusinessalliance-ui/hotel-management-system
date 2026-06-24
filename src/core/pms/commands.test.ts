import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase } from "../../data/sqlite/index.ts";
import { AccessEngine } from "../../access/AccessEngine.ts";
import { NoopDoorProvider } from "../../access/adapters/NoopDoorProvider.ts";
import { PmsCore } from "./index.ts";
import {
  changeReservationStatus,
  changeRoomStatus,
  advanceHousekeepingTask,
  recordPayment,
  recordRefund,
  login,
  createUser,
  updateUser,
  setUserPassword,
  updateProperty,
  createRoomType,
  createRoom,
  createGuest,
  updateGuest,
  createReservation,
  updateReservation,
  issueRoomKey,
  revokeRoomKey,
  revealKeySecret,
} from "./commands.ts";
import { netBalance } from "../billing/index.ts";
import { createFieldCipher } from "../../data/crypto.ts";

const cipher = createFieldCipher(Buffer.alloc(32, 7)); // fixed test key
const encryptField = cipher.encrypt;
const decryptField = cipher.decrypt;
import type { Database } from "../../data/db.ts";
import { hashPassword, verifyPassword, legacyHash } from "../../data/auth.ts";

/** Write path: status transitions persist and are guarded by the state machine. */
describe("changeReservationStatus", () => {
  let db: Database;
  let pms: PmsCore;

  beforeEach(async () => {
    // Fresh DB per test so writes don't leak between cases.
    const res = await initDatabase({ filename: ":memory:", seed: true });
    db = res.db;
    pms = new PmsCore({ data: res.data, access: new AccessEngine(new NoopDoorProvider()) });
  });

  afterEach(async () => {
    await db.close();
  });

  it("applies and persists a valid transition (confirmed → checked_in)", async () => {
    const result = await changeReservationStatus(pms, "resv_demo", "checked_in");
    expect(result.ok).toBe(true);

    const reloaded = await pms.data.reservations.getById("resv_demo");
    expect(reloaded?.status).toBe("checked_in");
  });

  it("rejects an invalid transition and leaves state unchanged", async () => {
    const result = await changeReservationStatus(pms, "resv_demo", "checked_out");
    expect(result.ok).toBe(false);

    const reloaded = await pms.data.reservations.getById("resv_demo");
    expect(reloaded?.status).toBe("confirmed");
  });

  it("voids the reservation's invoice on cancellation", async () => {
    // Seeded inv_demo (open) belongs to resv_demo; cancelling should void it.
    const result = await changeReservationStatus(pms, "resv_demo", "cancelled");
    expect(result.ok).toBe(true);

    const invoice = await pms.data.invoices.getById("inv_demo");
    expect(invoice?.status).toBe("void");
  });

  it("records a refund on a voided invoice, clearing the owed amount", async () => {
    // Cancelling voids inv_demo, which had a 20000 payment → 20000 refund owed.
    await changeReservationStatus(pms, "resv_demo", "cancelled");
    const refund = await recordRefund(pms, "inv_demo");
    expect(refund.ok).toBe(true);
    if (refund.ok) expect(refund.value.amount).toBe(-20000);

    const invoice = await pms.data.invoices.getById("inv_demo");
    const payments = (await pms.data.payments.list()).filter((p) => p.invoiceId === "inv_demo");
    expect(netBalance(invoice!.total, invoice!.status, payments)).toBe(0);
  });

  it("rejects a refund when none is owed", async () => {
    // Fresh seed: inv_demo is open with a positive balance, not a refund.
    const result = await recordRefund(pms, "inv_demo");
    expect(result.ok).toBe(false);
  });

  it("frees the room after cancellation (re-booking allowed)", async () => {
    await changeReservationStatus(pms, "resv_demo", "cancelled");
    // room_201 was occupied by resv_demo for 2026-06-12..15; now bookable again.
    const rebook = await createReservation(pms, {
      guestId: "guest_demo",
      roomId: "room_201",
      checkIn: "2026-06-13",
      checkOut: "2026-06-16",
    });
    expect(rebook.ok).toBe(true);
  });

  it("errors for an unknown reservation id", async () => {
    const result = await changeReservationStatus(pms, "does_not_exist", "confirmed");
    expect(result.ok).toBe(false);
  });

  it("applies and persists a valid room transition (occupied → dirty)", async () => {
    // Seeded room_201 starts 'occupied'.
    const result = await changeRoomStatus(pms, "room_201", "dirty");
    expect(result.ok).toBe(true);

    const reloaded = await pms.data.rooms.getById("room_201");
    expect(reloaded?.status).toBe("dirty");
  });

  it("rejects an invalid room transition and leaves state unchanged", async () => {
    // room_101 is 'available'; available → dirty is not allowed.
    const result = await changeRoomStatus(pms, "room_101", "dirty");
    expect(result.ok).toBe(false);

    const reloaded = await pms.data.rooms.getById("room_101");
    expect(reloaded?.status).toBe("available");
  });

  it("advances a housekeeping task (pending → in_progress) and persists", async () => {
    // Seeded hk_demo starts 'pending'.
    const result = await advanceHousekeepingTask(pms, "hk_demo", "in_progress");
    expect(result.ok).toBe(true);

    const reloaded = await pms.data.housekeeping.getById("hk_demo");
    expect(reloaded?.status).toBe("in_progress");
  });

  it("rejects an invalid housekeeping transition", async () => {
    // pending → done is not allowed (must go through in_progress).
    const result = await advanceHousekeepingTask(pms, "hk_demo", "done");
    expect(result.ok).toBe(false);
  });

  it("records a partial payment and leaves the invoice open", async () => {
    // Seeded inv_demo: total 36000, one 20000 payment → balance 16000.
    const result = await recordPayment(pms, "inv_demo", 5000, "cash");
    expect(result.ok).toBe(true);

    const invoice = await pms.data.invoices.getById("inv_demo");
    expect(invoice?.status).toBe("open");
    const payments = (await pms.data.payments.list()).filter((p) => p.invoiceId === "inv_demo");
    expect(payments).toHaveLength(2);
  });

  it("marks the invoice paid once the balance is cleared", async () => {
    const result = await recordPayment(pms, "inv_demo", 16000, "card");
    expect(result.ok).toBe(true);

    const invoice = await pms.data.invoices.getById("inv_demo");
    expect(invoice?.status).toBe("paid");
  });

  it("rejects a non-positive amount and an unknown invoice", async () => {
    expect((await recordPayment(pms, "inv_demo", 0, "cash")).ok).toBe(false);
    expect((await recordPayment(pms, "nope", 1000, "cash")).ok).toBe(false);
  });

  it("logs in the seeded admin with admin / admin", async () => {
    const ok = await login(pms, "admin", "admin", verifyPassword, hashPassword);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.roleIds).toContain("role_owner");
  });

  it("rejects a wrong password or unknown user", async () => {
    expect((await login(pms, "admin", "wrong", verifyPassword, hashPassword)).ok).toBe(false);
    expect((await login(pms, "ghost", "admin", verifyPassword, hashPassword)).ok).toBe(false);
  });

  it("upgrades a legacy SHA-256 hash to scrypt after a successful login", async () => {
    // Create a user, then overwrite their stored hash with a legacy one.
    const created = await createUser(
      pms,
      { username: "legacy_user", displayName: "Legacy", password: "irrelevant", roleIds: ["role_front"], active: true },
      hashPassword
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await pms.data.users.setPasswordHash(created.value.id, legacyHash("secret"));

    // Stored hash is legacy before login.
    const before = await pms.data.users.findCredentials("legacy_user");
    expect(before?.passwordHash.startsWith("scrypt:")).toBe(false);

    // Logging in with the legacy password succeeds…
    const ok = await login(pms, "legacy_user", "secret", verifyPassword, hashPassword);
    expect(ok.ok).toBe(true);

    // …and the stored hash is now upgraded to scrypt.
    const after = await pms.data.users.findCredentials("legacy_user");
    expect(after?.passwordHash.startsWith("scrypt:v1:")).toBe(true);
    // The upgraded hash still verifies the same password.
    expect((await login(pms, "legacy_user", "secret", verifyPassword, hashPassword)).ok).toBe(true);
  });

  it("creates a user who can then log in, and rejects duplicate usernames", async () => {
    const created = await createUser(
      pms,
      {
        username: "frontdesk1",
        displayName: "Front Desk One",
        password: "pw123",
        roleIds: ["role_front"],
        active: true,
      },
      hashPassword
    );
    expect(created.ok).toBe(true);

    const signedIn = await login(pms, "frontdesk1", "pw123", verifyPassword, hashPassword);
    expect(signedIn.ok).toBe(true);
    if (signedIn.ok) expect(signedIn.value.roleIds).toEqual(["role_front"]);

    // Duplicate username rejected.
    const dup = await createUser(
      pms,
      { username: "admin", displayName: "X", password: "p", roleIds: [], active: true },
      hashPassword
    );
    expect(dup.ok).toBe(false);
  });

  it("updates a user's roles/active and can reset their password", async () => {
    const created = await createUser(
      pms,
      { username: "edit_me", displayName: "Edit Me", password: "old", roleIds: ["role_front"], active: true },
      hashPassword
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    // Deactivate + change roles.
    const updated = await updateUser(pms, {
      id,
      displayName: "Edited Name",
      roleIds: ["role_owner"],
      active: false,
    });
    expect(updated.ok).toBe(true);
    const reloaded = await pms.data.users.getById(id);
    expect(reloaded?.displayName).toBe("Edited Name");
    expect(reloaded?.active).toBe(false);
    expect(reloaded?.roleIds).toEqual(["role_owner"]);

    // Inactive users can't log in even with the right password.
    expect((await login(pms, "edit_me", "old", verifyPassword, hashPassword)).ok).toBe(false);

    // Reactivate + reset password, then login with the new password.
    await updateUser(pms, { id, displayName: "Edited Name", roleIds: ["role_front"], active: true });
    const pw = await setUserPassword(pms, id, "fresh", hashPassword);
    expect(pw.ok).toBe(true);
    expect((await login(pms, "edit_me", "fresh", verifyPassword, hashPassword)).ok).toBe(true);
  });

  it("rejects updateUser/setUserPassword for unknown ids", async () => {
    expect(
      (await updateUser(pms, { id: "nope", displayName: "X", roleIds: [], active: true })).ok
    ).toBe(false);
    expect((await setUserPassword(pms, "nope", "pw", hashPassword)).ok).toBe(false);
  });

  it("updates property details and normalizes/validates currency", async () => {
    const ok = await updateProperty(pms, {
      id: "prop_demo",
      name: "Seaside Hotel",
      type: "hotel",
      address: "2 Harbour Road",
      timezone: "UTC",
      currency: "eur", // should be upper-cased
    });
    expect(ok.ok).toBe(true);

    const reloaded = await pms.data.properties.getById("prop_demo");
    expect(reloaded?.name).toBe("Seaside Hotel");
    expect(reloaded?.type).toBe("hotel");
    expect(reloaded?.currency).toBe("EUR");

    // Invalid currency rejected.
    expect(
      (await updateProperty(pms, {
        id: "prop_demo",
        name: "X",
        type: "hotel",
        timezone: "UTC",
        currency: "dollars",
      })).ok
    ).toBe(false);
  });

  it("creates a room type and rejects a duplicate code", async () => {
    const ok = await createRoomType(pms, {
      code: "SUITE",
      name: "Suite",
      basePrice: 25000,
      maxOccupancy: 4,
    });
    expect(ok.ok).toBe(true);

    // STD already exists from seed.
    const dup = await createRoomType(pms, { code: "STD", name: "Standard 2", basePrice: 9000, maxOccupancy: 2 });
    expect(dup.ok).toBe(false);
  });

  it("creates a room and rejects a duplicate number / unknown type", async () => {
    const ok = await createRoom(pms, { number: "301", floor: "3", roomTypeId: "rt_dlx" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.status).toBe("available");

    // room 101 exists from seed.
    expect((await createRoom(pms, { number: "101", roomTypeId: "rt_std" })).ok).toBe(false);
    expect((await createRoom(pms, { number: "999", roomTypeId: "ghost" })).ok).toBe(false);
  });

  it("creates a guest, then a reservation, deriving rate from the room type", async () => {
    const guest = await createGuest(pms, { firstName: "Grace", lastName: "Hopper" });
    expect(guest.ok).toBe(true);
    if (!guest.ok) return;

    // room_101 is Standard (basePrice 9000); free for these dates.
    const res = await createReservation(pms, {
      guestId: guest.value.id,
      roomId: "room_101",
      checkIn: "2026-07-01",
      checkOut: "2026-07-03",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.ratePerNight).toBe(9000);
      expect(res.value.status).toBe("confirmed");

      // Booking auto-generates an open invoice for the full stay (2 nights × 9000).
      const invoices = (await pms.data.invoices.list()).filter(
        (i) => i.reservationId === res.value.id
      );
      expect(invoices).toHaveLength(1);
      expect(invoices[0].total).toBe(18000);
      expect(invoices[0].status).toBe("open");
    }
  });

  it("rejects createGuest with missing required fields", async () => {
    const result = await createGuest(pms, { firstName: "", lastName: "X" });
    expect(result.ok).toBe(false);
  });

  it("updates an existing guest, preserving unlisted fields", async () => {
    // Seeded guest_demo = Ada Lovelace. Update name + email; documentId preserved.
    const result = await updateGuest(pms, {
      id: "guest_demo",
      firstName: "Ada",
      lastName: "King",
      email: "ada.king@example.com",
    });
    expect(result.ok).toBe(true);

    const reloaded = await pms.data.guests.getById("guest_demo");
    expect(reloaded?.lastName).toBe("King");
    expect(reloaded?.email).toBe("ada.king@example.com");
    // phone was cleared (not provided) but the record still exists and is valid.
    expect(reloaded?.firstName).toBe("Ada");
  });

  it("rejects updateGuest for unknown id or invalid fields", async () => {
    expect((await updateGuest(pms, { id: "nope", firstName: "A", lastName: "B" })).ok).toBe(false);
    expect((await updateGuest(pms, { id: "guest_demo", firstName: "", lastName: "B" })).ok).toBe(
      false
    );
  });

  it("rejects a reservation that conflicts with an existing booking", async () => {
    // room_201 is occupied by seeded resv_demo for 2026-06-12 .. 2026-06-15.
    const result = await createReservation(pms, {
      guestId: "guest_demo",
      roomId: "room_201",
      checkIn: "2026-06-13",
      checkOut: "2026-06-16",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a reservation with a non-positive stay", async () => {
    const result = await createReservation(pms, {
      guestId: "guest_demo",
      roomId: "room_101",
      checkIn: "2026-07-05",
      checkOut: "2026-07-05",
    });
    expect(result.ok).toBe(false);
  });

  it("updates a reservation and recomputes its unpaid invoice", async () => {
    // New booking: room_101 (Standard 9000), 2 nights → invoice 18000, no payments.
    const created = await createReservation(pms, {
      guestId: "guest_demo",
      roomId: "room_101",
      checkIn: "2026-07-01",
      checkOut: "2026-07-03",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Extend to 3 nights → invoice should recompute to 27000.
    const updated = await updateReservation(pms, {
      reservationId: created.value.id,
      roomId: "room_101",
      checkIn: "2026-07-01",
      checkOut: "2026-07-04",
    });
    expect(updated.ok).toBe(true);

    const invoice = (await pms.data.invoices.list()).find(
      (i) => i.reservationId === created.value.id
    );
    expect(invoice?.total).toBe(27000);
  });

  it("does NOT recompute an invoice that already has payments", async () => {
    // Seeded inv_demo (resv_demo) has a 20000 payment; total 36000 must stay.
    const updated = await updateReservation(pms, {
      reservationId: "resv_demo",
      roomId: "room_201",
      checkIn: "2026-06-12",
      checkOut: "2026-06-18", // longer stay
    });
    expect(updated.ok).toBe(true);

    const invoice = await pms.data.invoices.getById("inv_demo");
    expect(invoice?.total).toBe(36000);
  });

  it("rejects an edit that conflicts with another booking", async () => {
    // New booking on room_101; try to move it onto room_201's occupied dates.
    const created = await createReservation(pms, {
      guestId: "guest_demo",
      roomId: "room_101",
      checkIn: "2026-09-01",
      checkOut: "2026-09-03",
    });
    if (!created.ok) return;
    const result = await updateReservation(pms, {
      reservationId: created.value.id,
      roomId: "room_201",
      checkIn: "2026-06-13",
      checkOut: "2026-06-16",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses to edit a non-upcoming reservation", async () => {
    await changeReservationStatus(pms, "resv_demo", "checked_in");
    const result = await updateReservation(pms, {
      reservationId: "resv_demo",
      roomId: "room_201",
      checkIn: "2026-06-12",
      checkOut: "2026-06-16",
    });
    expect(result.ok).toBe(false);
  });

  it("issues a PIN door key, persists its metadata, then revokes it", async () => {
    // Seeded resv_demo has room_201 assigned.
    const issued = await issueRoomKey(pms, "resv_demo", "pin", encryptField);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.value.doorId).toBe("room_201");
    expect(issued.value.medium).toBe("pin");
    expect(issued.value.secret).toMatch(/^\d{6}$/);

    // Metadata persisted (the AccessKeyRecord carries no secret field).
    const stored = await pms.data.accessKeys.getById(issued.value.id);
    expect(stored?.roomId).toBe("room_201");
    expect(stored?.provider).toBe("noop");
    expect(stored as unknown as { secret?: string }).not.toHaveProperty("secret");

    const revoked = await revokeRoomKey(pms, issued.value.id);
    expect(revoked.ok).toBe(true);
    const after = await pms.data.accessKeys.getById(issued.value.id);
    expect(after?.revoked).toBe(true);

    // Both actions are recorded in the audit log.
    const events = await pms.data.accessEvents.list();
    const actions = events.filter((e) => e.keyId === issued.value.id).map((e) => e.action);
    expect(actions).toContain("issued");
    expect(actions).toContain("revoked");
  });

  it("issues a CARD key, stores the secret ENCRYPTED, and reveals it on demand", async () => {
    const issued = await issueRoomKey(pms, "resv_demo", "card", encryptField);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.value.medium).toBe("card");

    // The stored secret is ciphertext, not the plaintext token.
    const ciphertext = await pms.data.accessKeys.getSecret(issued.value.id);
    expect(ciphertext).toBeTruthy();
    expect(ciphertext).not.toBe(issued.value.secret);

    // Reveal decrypts back to the original token.
    const revealed = await revealKeySecret(pms, issued.value.id, decryptField);
    expect(revealed.ok).toBe(true);
    if (revealed.ok) expect(revealed.value).toBe(issued.value.secret);
  });

  it("rejects issuing a key for an unknown reservation", async () => {
    const result = await issueRoomKey(pms, "nope", "pin", encryptField);
    expect(result.ok).toBe(false);
  });
});
