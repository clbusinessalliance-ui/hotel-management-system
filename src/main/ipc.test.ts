import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase } from "../data/sqlite/index.ts";
import { AccessEngine } from "../access/AccessEngine.ts";
import { NoopDoorProvider } from "../access/adapters/NoopDoorProvider.ts";
import { PmsCore } from "../core/pms/index.ts";
import { IPC } from "../shared/ipc/contract.ts";
import { registerPmsIpc, type IpcRegistry } from "./ipc.ts";
import { createFieldCipher } from "../data/crypto.ts";
import type { Database } from "../data/db.ts";

const testCipher = createFieldCipher(Buffer.alloc(32, 9));

/**
 * Verifies the IPC boundary without Electron: a fake registry captures the
 * registered handlers, then we invoke them and assert they return the expected
 * read-only data. Proves channel → use-case wiring is correct.
 */
class FakeRegistry implements IpcRegistry {
  readonly handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }
  invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    const fn = this.handlers.get(channel);
    if (!fn) throw new Error(`No handler registered for ${channel}`);
    return Promise.resolve(fn(null, ...args) as T);
  }
}

describe("registerPmsIpc", () => {
  let db: Database;
  let registry: FakeRegistry;

  beforeAll(async () => {
    const res = await initDatabase({ filename: ":memory:", seed: true });
    db = res.db;
    const pms = new PmsCore({ data: res.data, access: new AccessEngine(new NoopDoorProvider()) });
    registry = new FakeRegistry();
    registerPmsIpc(registry, pms, testCipher);
    // Establish a server-side session (admin '*') so write channels are authorized.
    await registry.invoke(IPC.login, "admin", "admin");
  });

  afterAll(async () => {
    await db.close();
  });

  it("registers a handler for every contract channel", () => {
    for (const channel of Object.values(IPC)) {
      expect(registry.handlers.has(channel)).toBe(true);
    }
  });

  it("pms:info handler returns app info", async () => {
    const info = await registry.invoke<{ version: string; doorProvider: string }>(IPC.info);
    expect(info.doorProvider).toBe("noop");
  });

  it("pms:summary handler returns seeded counts", async () => {
    const summary = await registry.invoke<{ counts: { rooms: number } }>(IPC.summary);
    expect(summary.counts.rooms).toBe(3);
  });

  it("pms:rooms handler returns the seeded rooms", async () => {
    const rooms = await registry.invoke<unknown[]>(IPC.rooms);
    expect(rooms).toHaveLength(3);
  });

  it("command handler applies a reservation status change with args", async () => {
    const result = await registry.invoke<{ ok: boolean }>(
      IPC.changeReservationStatus,
      "resv_demo",
      "checked_in"
    );
    expect(result.ok).toBe(true);

    const reservations = await registry.invoke<Array<{ id: string; status: string }>>(IPC.reservations);
    expect(reservations.find((r) => r.id === "resv_demo")?.status).toBe("checked_in");
  });

  it("command handler applies a room status change with args", async () => {
    const result = await registry.invoke<{ ok: boolean }>(
      IPC.changeRoomStatus,
      "room_201",
      "dirty"
    );
    expect(result.ok).toBe(true);

    const rooms = await registry.invoke<Array<{ id: string; status: string }>>(IPC.rooms);
    expect(rooms.find((r) => r.id === "room_201")?.status).toBe("dirty");
  });

  it("pms:invoices handler returns the seeded invoice", async () => {
    const invoices = await registry.invoke<unknown[]>(IPC.invoices);
    expect(invoices).toHaveLength(1);
  });

  it("command handler advances a housekeeping task with args", async () => {
    const result = await registry.invoke<{ ok: boolean }>(
      IPC.advanceHousekeepingTask,
      "hk_demo",
      "in_progress"
    );
    expect(result.ok).toBe(true);

    const tasks = await registry.invoke<Array<{ id: string; status: string }>>(IPC.housekeeping);
    expect(tasks.find((t) => t.id === "hk_demo")?.status).toBe("in_progress");
  });

  it("command handler records a payment with args", async () => {
    const result = await registry.invoke<{ ok: boolean }>(
      IPC.recordPayment,
      "inv_demo",
      16000,
      "card"
    );
    expect(result.ok).toBe(true);

    const payments = await registry.invoke<Array<{ invoiceId: string }>>(IPC.payments);
    expect(payments.filter((p) => p.invoiceId === "inv_demo").length).toBeGreaterThanOrEqual(2);
  });

  it("command handler routes recordRefund and returns a Result", async () => {
    const result = await registry.invoke<{ ok: boolean }>(IPC.recordRefund, "inv_demo");
    expect(typeof result.ok).toBe("boolean");
  });

  it("command handler issues a door key and reveals its encrypted secret", async () => {
    const result = await registry.invoke<{ ok: boolean; value?: { id: string; secret: string } }>(
      IPC.issueRoomKey,
      "resv_demo",
      "card"
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) return;
    const { id, secret } = result.value;

    // The issued key was persisted and is listable, and recorded an audit event.
    const keys = await registry.invoke<unknown[]>(IPC.accessKeys);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const events = await registry.invoke<Array<{ action: string }>>(IPC.accessEvents);
    expect(events.some((e) => e.action === "issued")).toBe(true);

    // Reveal decrypts the stored secret back to the issued value.
    const revealed = await registry.invoke<{ ok: boolean; value?: string }>(IPC.revealKeySecret, id);
    expect(revealed.ok).toBe(true);
    if (revealed.ok) expect(revealed.value).toBe(secret);
  });

  it("command handler logs in the admin and lists users/roles", async () => {
    const result = await registry.invoke<{ ok: boolean; value?: { username: string } }>(
      IPC.login,
      "admin",
      "admin"
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.value) expect(result.value.username).toBe("admin");

    const users = await registry.invoke<unknown[]>(IPC.users);
    expect(users.length).toBeGreaterThanOrEqual(1);
    const roles = await registry.invoke<unknown[]>(IPC.roles);
    expect(roles.length).toBeGreaterThanOrEqual(2);
  });

  it("command handler creates a user", async () => {
    const result = await registry.invoke<{ ok: boolean }>(IPC.createUser, {
      username: "hk1",
      displayName: "Housekeeper One",
      password: "pw",
      roleIds: ["role_front"],
      active: true,
    });
    expect(result.ok).toBe(true);

    const users = await registry.invoke<Array<{ username: string }>>(IPC.users);
    expect(users.some((u) => u.username === "hk1")).toBe(true);
  });

  it("command handler updates a user (deactivate)", async () => {
    const users = await registry.invoke<Array<{ id: string; username: string }>>(IPC.users);
    const hk = users.find((u) => u.username === "hk1");
    expect(hk).toBeTruthy();
    const result = await registry.invoke<{ ok: boolean }>(IPC.updateUser, {
      id: hk!.id,
      displayName: "Housekeeper One",
      roleIds: ["role_front"],
      active: false,
    });
    expect(result.ok).toBe(true);

    const after = await registry.invoke<Array<{ id: string; active: boolean }>>(IPC.users);
    expect(after.find((u) => u.id === hk!.id)?.active).toBe(false);
  });

  it("command handler updates property details", async () => {
    const result = await registry.invoke<{ ok: boolean }>(IPC.updateProperty, {
      id: "prop_demo",
      name: "Harbour Inn",
      type: "hotel",
      timezone: "UTC",
      currency: "USD",
    });
    expect(result.ok).toBe(true);

    const props = await registry.invoke<Array<{ id: string; name: string }>>(IPC.properties);
    expect(props.find((p) => p.id === "prop_demo")?.name).toBe("Harbour Inn");
  });

  it("command handler creates a room type and a room", async () => {
    const type = await registry.invoke<{ ok: boolean; value?: { id: string } }>(IPC.createRoomType, {
      code: "FAM",
      name: "Family",
      basePrice: 15000,
      maxOccupancy: 5,
    });
    expect(type.ok).toBe(true);
    if (!type.ok || !type.value) return;

    const room = await registry.invoke<{ ok: boolean }>(IPC.createRoom, {
      number: "401",
      roomTypeId: type.value.id,
    });
    expect(room.ok).toBe(true);

    const rooms = await registry.invoke<unknown[]>(IPC.rooms);
    expect(rooms.length).toBeGreaterThanOrEqual(4);
  });

  it("command handler updates a guest from an input object", async () => {
    const result = await registry.invoke<{ ok: boolean }>(IPC.updateGuest, {
      id: "guest_demo",
      firstName: "Ada",
      lastName: "Byron",
    });
    expect(result.ok).toBe(true);

    const guests = await registry.invoke<Array<{ id: string; lastName: string }>>(IPC.guests);
    expect(guests.find((g) => g.id === "guest_demo")?.lastName).toBe("Byron");
  });

  it("command handler routes updateReservation and returns a Result", async () => {
    const result = await registry.invoke<{ ok: boolean }>(IPC.updateReservation, {
      reservationId: "nope",
      roomId: "room_101",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
    });
    expect(typeof result.ok).toBe("boolean");
  });

  it("command handler creates a reservation from an input object", async () => {
    const result = await registry.invoke<{ ok: boolean }>(IPC.createReservation, {
      guestId: "guest_demo",
      roomId: "room_101",
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
    });
    expect(result.ok).toBe(true);

    const reservations = await registry.invoke<unknown[]>(IPC.reservations);
    expect(reservations.length).toBeGreaterThanOrEqual(2);
  });
});

describe("registerPmsIpc — server-side authorization", () => {
  let db: Database;
  let registry: FakeRegistry;

  beforeAll(async () => {
    const res = await initDatabase({ filename: ":memory:", seed: true });
    db = res.db;
    const pms = new PmsCore({ data: res.data, access: new AccessEngine(new NoopDoorProvider()) });
    registry = new FakeRegistry();
    registerPmsIpc(registry, pms, testCipher);
  });

  afterAll(async () => {
    await db.close();
  });

  it("rejects a write when not signed in", async () => {
    const result = await registry.invoke<{ ok: boolean; error?: string }>(
      IPC.changeRoomStatus,
      "room_101",
      "occupied"
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not signed in");
  });

  it("forbids a write the signed-in role lacks (front_desk → billing)", async () => {
    // Admin creates a front_desk user, who then signs in.
    await registry.invoke(IPC.login, "admin", "admin");
    await registry.invoke(IPC.createUser, {
      username: "fd",
      displayName: "Front Desk",
      password: "pw",
      roleIds: ["role_front"],
      active: true,
    });
    await registry.invoke(IPC.login, "fd", "pw");

    // front_desk has billing:read, NOT billing:update → payment is forbidden.
    const denied = await registry.invoke<{ ok: boolean; error?: string }>(
      IPC.recordPayment,
      "inv_demo",
      1000,
      "cash"
    );
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain("Forbidden");

    // …but front_desk CAN issue a door key (access:issue) and edit reservations.
    const allowed = await registry.invoke<{ ok: boolean }>(IPC.issueRoomKey, "resv_demo", "pin");
    expect(allowed.ok).toBe(true);
  });
});
