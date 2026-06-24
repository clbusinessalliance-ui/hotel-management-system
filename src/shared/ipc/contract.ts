/**
 * IPC contract — the single, transport-neutral source of truth for the
 * read-only API the desktop renderer may call on the main process.
 *
 * Imports ONLY shared domain types: no Electron, no database, no UI. Both the
 * main process (handlers) and the renderer (typed client) depend on this file,
 * which keeps the two sides honest. Later, a cloud HTTP client can implement the
 * same `PmsBridge` surface unchanged.
 */

import type {
  AccessEvent,
  AccessKeyRecord,
  DoorKey,
  Guest,
  HousekeepingStatus,
  HousekeepingTask,
  Invoice,
  KeyMedium,
  Payment,
  PaymentMethod,
  Property,
  Reservation,
  ReservationStatus,
  Result,
  Role,
  Room,
  RoomStatus,
  RoomType,
  User,
} from "../types/index.ts";

/** Channel names. Values are the strings passed to ipcRenderer.invoke / ipcMain.handle. */
export const IPC = {
  info: "pms:info",
  summary: "pms:summary",
  properties: "pms:properties",
  rooms: "pms:rooms",
  roomTypes: "pms:roomTypes",
  reservations: "pms:reservations",
  guests: "pms:guests",
  housekeeping: "pms:housekeeping",
  invoices: "pms:invoices",
  payments: "pms:payments",
  accessKeys: "pms:accessKeys",
  accessEvents: "pms:accessEvents",
  users: "pms:users",
  roles: "pms:roles",
  // commands (writes)
  login: "pms:auth:login",
  logout: "pms:auth:logout",
  createUser: "pms:user:create",
  updateUser: "pms:user:update",
  setUserPassword: "pms:user:setPassword",
  changeReservationStatus: "pms:reservation:changeStatus",
  changeRoomStatus: "pms:room:changeStatus",
  advanceHousekeepingTask: "pms:housekeeping:advance",
  recordPayment: "pms:payment:record",
  recordRefund: "pms:payment:refund",
  updateProperty: "pms:property:update",
  createRoomType: "pms:roomType:create",
  createRoom: "pms:room:create",
  createGuest: "pms:guest:create",
  updateGuest: "pms:guest:update",
  createReservation: "pms:reservation:create",
  updateReservation: "pms:reservation:update",
  issueRoomKey: "pms:access:issueKey",
  revokeRoomKey: "pms:access:revokeKey",
  revealKeySecret: "pms:access:revealSecret",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

export interface PmsInfo {
  version: string;
  doorProvider: string;
}

/** Lightweight, read-only dashboard snapshot (counts + the active property). */
export interface PmsSummary {
  property: Pick<Property, "id" | "name" | "type"> | null;
  counts: {
    properties: number;
    rooms: number;
    roomTypes: number;
    guests: number;
    reservations: number;
    invoices: number;
    users: number;
  };
}

/** Input to create a staff user account. */
export interface CreateUserInput {
  username: string;
  displayName: string;
  email?: string;
  password: string;
  roleIds: string[];
  active: boolean;
}

/** Input to update an existing user (username is immutable). */
export interface UpdateUserInput {
  id: string;
  displayName: string;
  email?: string;
  roleIds: string[];
  active: boolean;
}

/** Input to update the property's details. */
export interface UpdatePropertyInput {
  id: string;
  name: string;
  type: Property["type"];
  address?: string;
  timezone: string;
  currency: string;
}

/** Input to create a room type (price in minor units). Property is derived server-side. */
export interface CreateRoomTypeInput {
  code: string;
  name: string;
  basePrice: number;
  maxOccupancy: number;
}

/** Input to create a room. Property is derived from the room type. */
export interface CreateRoomInput {
  number: string;
  floor?: string;
  roomTypeId: string;
}

/** Input to create a guest (write). */
export interface CreateGuestInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  documentId?: string;
  nationality?: string;
}

/** Input to create a reservation (write). Rate/currency are derived server-side. */
export interface CreateReservationInput {
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  notes?: string;
}

/** Input to update an existing guest. Fields not listed (e.g. documentId) are preserved. */
export interface UpdateGuestInput {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  nationality?: string;
}

/** Input to update an upcoming reservation's room/dates/notes. */
export interface UpdateReservationInput {
  reservationId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  notes?: string;
}

/**
 * The typed surface exposed on `window.pms` in the renderer. Read methods return
 * plain data; command methods return a `Result` so the renderer can show errors.
 */
export interface PmsBridge {
  getInfo(): Promise<PmsInfo>;
  getSummary(): Promise<PmsSummary>;
  listProperties(): Promise<Property[]>;
  listRooms(): Promise<Room[]>;
  listRoomTypes(): Promise<RoomType[]>;
  listReservations(): Promise<Reservation[]>;
  listGuests(): Promise<Guest[]>;
  listHousekeeping(): Promise<HousekeepingTask[]>;
  listInvoices(): Promise<Invoice[]>;
  listPayments(): Promise<Payment[]>;
  listAccessKeys(): Promise<AccessKeyRecord[]>;
  listAccessEvents(): Promise<AccessEvent[]>;
  listUsers(): Promise<User[]>;
  listRoles(): Promise<Role[]>;

  // Commands (writes). Return a Result so the renderer can show success/error.
  login(username: string, password: string): Promise<Result<User>>;
  logout(): Promise<void>;
  createUser(input: CreateUserInput): Promise<Result<User>>;
  updateUser(input: UpdateUserInput): Promise<Result<User>>;
  setUserPassword(userId: string, password: string): Promise<Result<true>>;
  changeReservationStatus(id: string, to: ReservationStatus): Promise<Result<Reservation>>;
  changeRoomStatus(id: string, to: RoomStatus): Promise<Result<Room>>;
  advanceHousekeepingTask(id: string, to: HousekeepingStatus): Promise<Result<HousekeepingTask>>;
  recordPayment(
    invoiceId: string,
    amount: number,
    method: PaymentMethod,
    reference?: string
  ): Promise<Result<Payment>>;
  recordRefund(invoiceId: string): Promise<Result<Payment>>;
  updateProperty(input: UpdatePropertyInput): Promise<Result<Property>>;
  createRoomType(input: CreateRoomTypeInput): Promise<Result<RoomType>>;
  createRoom(input: CreateRoomInput): Promise<Result<Room>>;
  createGuest(input: CreateGuestInput): Promise<Result<Guest>>;
  updateGuest(input: UpdateGuestInput): Promise<Result<Guest>>;
  createReservation(input: CreateReservationInput): Promise<Result<Reservation>>;
  updateReservation(input: UpdateReservationInput): Promise<Result<Reservation>>;
  issueRoomKey(reservationId: string, medium: KeyMedium): Promise<Result<DoorKey>>;
  revokeRoomKey(keyId: string): Promise<Result<true>>;
  revealKeySecret(keyId: string): Promise<Result<string>>;
}
