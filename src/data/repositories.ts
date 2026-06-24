/**
 * Repository PORTS (interfaces) for persistence.
 *
 * The domain core depends on these interfaces — never on a concrete database.
 * Today a SQLite-backed implementation will satisfy them; later the same
 * interfaces can be fulfilled by an HTTP client against a cloud API, with zero
 * changes to the domain modules.
 */

import type {
  ID,
  Property,
  Room,
  RoomType,
  Guest,
  Reservation,
  Invoice,
  Payment,
  HousekeepingTask,
  User,
  Role,
  AccessKeyRecord,
  AccessEvent,
} from "@shared/types/index.ts";

export interface Repository<T extends { id: ID }> {
  getById(id: ID): Promise<T | null>;
  list(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<void>;
}

export interface UserRepository extends Repository<User> {
  findByUsername(username: string): Promise<User | null>;
  /** Load a user together with their stored password hash (for authentication). */
  findCredentials(username: string): Promise<{ user: User; passwordHash: string } | null>;
  /** Set/replace a user's password hash. */
  setPasswordHash(userId: ID, passwordHash: string): Promise<void>;
}
export type RoleRepository = Repository<Role>;
export type PropertyRepository = Repository<Property>;
export type RoomRepository = Repository<Room>;
export type RoomTypeRepository = Repository<RoomType>;
export type GuestRepository = Repository<Guest>;

export interface ReservationRepository extends Repository<Reservation> {
  findByGuest(guestId: ID): Promise<Reservation[]>;
}
export type InvoiceRepository = Repository<Invoice>;
export type PaymentRepository = Repository<Payment>;
export type HousekeepingRepository = Repository<HousekeepingTask>;
export interface AccessKeyRepository extends Repository<AccessKeyRecord> {
  /** Store the encrypted credential ciphertext for a key. */
  setSecret(keyId: ID, ciphertext: string): Promise<void>;
  /** Read the encrypted credential ciphertext for a key (null if none). */
  getSecret(keyId: ID): Promise<string | null>;
}
export type AccessEventRepository = Repository<AccessEvent>;

/** Aggregate of all repositories handed to the domain at the composition root. */
export interface DataContext {
  users: UserRepository;
  roles: RoleRepository;
  properties: PropertyRepository;
  rooms: RoomRepository;
  roomTypes: RoomTypeRepository;
  guests: GuestRepository;
  reservations: ReservationRepository;
  invoices: InvoiceRepository;
  payments: PaymentRepository;
  housekeeping: HousekeepingRepository;
  accessKeys: AccessKeyRepository;
  accessEvents: AccessEventRepository;
}
