/**
 * IPC wiring for the main process.
 *
 * Maps shared-contract channels to PMS use-cases. Write channels are guarded by a
 * server-side session: login establishes the authenticated user, and each command
 * verifies that user's permission before executing. This is the real security
 * boundary — UI gating in the renderer is convenience only.
 *
 * The registry is typed structurally (not against Electron's `IpcMain`) so this
 * module imports no Electron code and is unit-testable with a fake registry.
 */

import { IPC } from "@shared/ipc/contract.ts";
import { hashPassword, verifyPassword } from "../data/auth.ts";
import type { FieldCipher } from "../data/crypto.ts";
import { hasPermission } from "@core/auth/index.ts";
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
import type {
  HousekeepingStatus,
  KeyMedium,
  PaymentMethod,
  ReservationStatus,
  RoomStatus,
  User,
} from "@shared/types/index.ts";
import type { PmsCore } from "@core/pms/index.ts";
import * as queries from "@core/pms/queries.ts";
import * as commands from "@core/pms/commands.ts";

export interface IpcRegistry {
  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>
  ): void;
}

/** Register every PMS channel against the given core instance and field cipher. */
export function registerPmsIpc(registry: IpcRegistry, pms: PmsCore, cipher: FieldCipher): void {
  // Server-side session for this instance (one window). Set by login, cleared by logout.
  let session: User | null = null;

  /** Returns an error string if the session may NOT perform `permission`, else null. */
  async function deny(permission: string): Promise<string | null> {
    if (!session) return "Not signed in";
    const roles = await pms.data.roles.list();
    return hasPermission(session, roles, permission) ? null : `Forbidden: requires ${permission}`;
  }

  /** Wrap a write handler so it runs only if the session holds `permission`. */
  const guarded =
    (permission: string, run: (...args: unknown[]) => Promise<unknown>) =>
    async (_event: unknown, ...args: unknown[]): Promise<unknown> => {
      const error = await deny(permission);
      if (error) return { ok: false, error };
      return run(...args);
    };

  // ── Reads (require no permission; renderer only calls them post-login) ──
  registry.handle(IPC.info, () => queries.getInfo(pms));
  registry.handle(IPC.summary, () => queries.getSummary(pms));
  registry.handle(IPC.rooms, () => queries.listRooms(pms));
  registry.handle(IPC.roomTypes, () => queries.listRoomTypes(pms));
  registry.handle(IPC.reservations, () => queries.listReservations(pms));
  registry.handle(IPC.guests, () => queries.listGuests(pms));
  registry.handle(IPC.housekeeping, () => queries.listHousekeeping(pms));
  registry.handle(IPC.invoices, () => queries.listInvoices(pms));
  registry.handle(IPC.payments, () => queries.listPayments(pms));
  registry.handle(IPC.accessKeys, () => queries.listAccessKeys(pms));
  registry.handle(IPC.accessEvents, () => queries.listAccessEvents(pms));
  registry.handle(IPC.properties, () => queries.listProperties(pms));
  registry.handle(IPC.users, () => queries.listUsers(pms));
  registry.handle(IPC.roles, () => queries.listRoles(pms));

  // ── Auth ───────────────────────────────────────────────────────────────
  registry.handle(IPC.login, async (_event, username, password) => {
    const result = await commands.login(
      pms,
      username as string,
      password as string,
      verifyPassword,
      hashPassword
    );
    if (result.ok) session = result.value;
    return result;
  });
  registry.handle(IPC.logout, () => {
    session = null;
  });

  // ── Commands (writes) — each guarded by a required permission ────────────
  registry.handle(
    IPC.createUser,
    guarded("user:create", (input) => commands.createUser(pms, input as CreateUserInput, hashPassword))
  );
  registry.handle(
    IPC.updateUser,
    guarded("user:update", (input) => commands.updateUser(pms, input as UpdateUserInput))
  );
  registry.handle(
    IPC.setUserPassword,
    guarded("user:update", (userId, password) =>
      commands.setUserPassword(pms, userId as string, password as string, hashPassword)
    )
  );
  registry.handle(
    IPC.changeReservationStatus,
    guarded("reservation:update", (id, to) =>
      commands.changeReservationStatus(pms, id as string, to as ReservationStatus)
    )
  );
  registry.handle(
    IPC.createReservation,
    guarded("reservation:update", (input) =>
      commands.createReservation(pms, input as CreateReservationInput)
    )
  );
  registry.handle(
    IPC.updateReservation,
    guarded("reservation:update", (input) =>
      commands.updateReservation(pms, input as UpdateReservationInput)
    )
  );
  registry.handle(
    IPC.changeRoomStatus,
    guarded("room:update", (id, to) => commands.changeRoomStatus(pms, id as string, to as RoomStatus))
  );
  registry.handle(
    IPC.advanceHousekeepingTask,
    guarded("housekeeping:update", (id, to) =>
      commands.advanceHousekeepingTask(pms, id as string, to as HousekeepingStatus)
    )
  );
  registry.handle(
    IPC.recordPayment,
    guarded("billing:update", (invoiceId, amount, method, reference) =>
      commands.recordPayment(
        pms,
        invoiceId as string,
        amount as number,
        method as PaymentMethod,
        reference as string | undefined
      )
    )
  );
  registry.handle(
    IPC.recordRefund,
    guarded("billing:update", (invoiceId) => commands.recordRefund(pms, invoiceId as string))
  );
  registry.handle(
    IPC.updateProperty,
    guarded("property:update", (input) => commands.updateProperty(pms, input as UpdatePropertyInput))
  );
  registry.handle(
    IPC.createRoomType,
    guarded("property:update", (input) => commands.createRoomType(pms, input as CreateRoomTypeInput))
  );
  registry.handle(
    IPC.createRoom,
    guarded("property:update", (input) => commands.createRoom(pms, input as CreateRoomInput))
  );
  registry.handle(
    IPC.createGuest,
    guarded("guest:update", (input) => commands.createGuest(pms, input as CreateGuestInput))
  );
  registry.handle(
    IPC.updateGuest,
    guarded("guest:update", (input) => commands.updateGuest(pms, input as UpdateGuestInput))
  );
  registry.handle(
    IPC.issueRoomKey,
    guarded("access:issue", (reservationId, medium) =>
      commands.issueRoomKey(pms, reservationId as string, medium as KeyMedium, cipher.encrypt)
    )
  );
  registry.handle(
    IPC.revokeRoomKey,
    guarded("access:issue", (keyId) => commands.revokeRoomKey(pms, keyId as string))
  );
  registry.handle(
    IPC.revealKeySecret,
    guarded("access:issue", (keyId) => commands.revealKeySecret(pms, keyId as string, cipher.decrypt))
  );
}
