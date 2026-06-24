/**
 * Read-only PMS query use-cases.
 *
 * Thin orchestration over repositories — list and count reads only, no business
 * rules. These are the functions the IPC layer in the main process exposes to
 * the renderer. They depend on `PmsCore` (and thus only on repository ports),
 * never on a concrete database or on Electron.
 */

import type { PmsCore } from "./index.ts";
import type { PmsInfo, PmsSummary } from "@shared/ipc/contract.ts";
import type {
  AccessEvent,
  AccessKeyRecord,
  Guest,
  HousekeepingTask,
  Invoice,
  Payment,
  Property,
  Reservation,
  Role,
  Room,
  RoomType,
  User,
} from "@shared/types/index.ts";

export async function getInfo(pms: PmsCore): Promise<PmsInfo> {
  return pms.info();
}

export async function getSummary(pms: PmsCore): Promise<PmsSummary> {
  const { data } = pms;
  const [properties, rooms, roomTypes, guests, reservations, invoices, users] = await Promise.all([
    data.properties.list(),
    data.rooms.list(),
    data.roomTypes.list(),
    data.guests.list(),
    data.reservations.list(),
    data.invoices.list(),
    data.users.list(),
  ]);

  const property = properties[0];
  return {
    property: property ? { id: property.id, name: property.name, type: property.type } : null,
    counts: {
      properties: properties.length,
      rooms: rooms.length,
      roomTypes: roomTypes.length,
      guests: guests.length,
      reservations: reservations.length,
      invoices: invoices.length,
      users: users.length,
    },
  };
}

export async function listProperties(pms: PmsCore): Promise<Property[]> {
  return pms.data.properties.list();
}

export async function listRooms(pms: PmsCore): Promise<Room[]> {
  return pms.data.rooms.list();
}

export async function listRoomTypes(pms: PmsCore): Promise<RoomType[]> {
  return pms.data.roomTypes.list();
}

export async function listReservations(pms: PmsCore): Promise<Reservation[]> {
  return pms.data.reservations.list();
}

export async function listGuests(pms: PmsCore): Promise<Guest[]> {
  return pms.data.guests.list();
}

export async function listHousekeeping(pms: PmsCore): Promise<HousekeepingTask[]> {
  return pms.data.housekeeping.list();
}

export async function listInvoices(pms: PmsCore): Promise<Invoice[]> {
  return pms.data.invoices.list();
}

export async function listPayments(pms: PmsCore): Promise<Payment[]> {
  return pms.data.payments.list();
}

export async function listAccessKeys(pms: PmsCore): Promise<AccessKeyRecord[]> {
  return pms.data.accessKeys.list();
}

export async function listAccessEvents(pms: PmsCore): Promise<AccessEvent[]> {
  return pms.data.accessEvents.list();
}

export async function listUsers(pms: PmsCore): Promise<User[]> {
  return pms.data.users.list();
}

export async function listRoles(pms: PmsCore): Promise<Role[]> {
  return pms.data.roles.list();
}
