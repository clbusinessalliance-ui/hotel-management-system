/**
 * SQLite-backed concrete repositories.
 *
 * Each fulfils a repository PORT declared in ../repositories.ts. The domain core
 * depends only on those interfaces, so swapping this implementation for a cloud
 * HTTP client later requires no core changes.
 */

import type { Database } from "../db.ts";
import type {
  AccessEventRepository,
  AccessKeyRepository,
  DataContext,
  GuestRepository,
  HousekeepingRepository,
  InvoiceRepository,
  PaymentRepository,
  PropertyRepository,
  ReservationRepository,
  RoleRepository,
  RoomRepository,
  RoomTypeRepository,
  Repository,
  UserRepository,
} from "../repositories.ts";
import type {
  AccessEvent,
  AccessKeyRecord,
  Guest,
  HousekeepingTask,
  ID,
  Invoice,
  Payment,
  Property,
  Reservation,
  Role,
  Room,
  RoomType,
  User,
} from "@shared/types/index.ts";

type Row = Record<string, unknown>;

/** null → undefined, so optional domain fields stay `undefined`, not `null`. */
const opt = <T>(v: unknown): T | undefined => (v === null || v === undefined ? undefined : (v as T));

interface RowMapper<T> {
  table: string;
  toRow(entity: T): Row;
  fromRow(row: Row): T;
}

/** Generic CRUD against a single table, driven by a row mapper. */
class SqliteRepository<T extends { id: ID }> implements Repository<T> {
  constructor(protected readonly db: Database, protected readonly mapper: RowMapper<T>) {}

  async getById(id: ID): Promise<T | null> {
    const rows = await this.db.query<Row>(`SELECT * FROM ${this.mapper.table} WHERE id = ?`, [id]);
    return rows[0] ? this.mapper.fromRow(rows[0]) : null;
  }

  async list(): Promise<T[]> {
    const rows = await this.db.query<Row>(`SELECT * FROM ${this.mapper.table}`);
    return rows.map((r) => this.mapper.fromRow(r));
  }

  async save(entity: T): Promise<T> {
    const row = this.mapper.toRow(entity);
    const cols = Object.keys(row);
    const placeholders = cols.map(() => "?").join(", ");
    const updates = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
    const sql =
      `INSERT INTO ${this.mapper.table} (${cols.join(", ")}) VALUES (${placeholders}) ` +
      `ON CONFLICT(id) DO UPDATE SET ${updates}`;
    await this.db.query(sql, cols.map((c) => row[c]));
    return entity;
  }

  async delete(id: ID): Promise<void> {
    await this.db.query(`DELETE FROM ${this.mapper.table} WHERE id = ?`, [id]);
  }
}

// ── Mappers ───────────────────────────────────────────────────────────────

const propertyMapper: RowMapper<Property> = {
  table: "properties",
  toRow: (p) => ({
    id: p.id, name: p.name, type: p.type, address: p.address ?? null,
    timezone: p.timezone, currency: p.currency, created_at: p.createdAt, updated_at: p.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, name: r.name as string, type: r.type as Property["type"],
    address: opt<string>(r.address), timezone: r.timezone as string, currency: r.currency as string,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

const roomTypeMapper: RowMapper<RoomType> = {
  table: "room_types",
  toRow: (t) => ({
    id: t.id, property_id: t.propertyId, code: t.code, name: t.name,
    base_price: t.basePrice, max_occupancy: t.maxOccupancy, created_at: t.createdAt, updated_at: t.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, propertyId: r.property_id as ID, code: r.code as string, name: r.name as string,
    basePrice: r.base_price as number, maxOccupancy: r.max_occupancy as number,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

const roomMapper: RowMapper<Room> = {
  table: "rooms",
  toRow: (r) => ({
    id: r.id, property_id: r.propertyId, room_type_id: r.roomTypeId, number: r.number,
    floor: r.floor ?? null, status: r.status, created_at: r.createdAt, updated_at: r.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, propertyId: r.property_id as ID, roomTypeId: r.room_type_id as ID,
    number: r.number as string, floor: opt<string>(r.floor), status: r.status as Room["status"],
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

const guestMapper: RowMapper<Guest> = {
  table: "guests",
  toRow: (g) => ({
    id: g.id, first_name: g.firstName, last_name: g.lastName, email: g.email ?? null,
    phone: g.phone ?? null, document_id: g.documentId ?? null, nationality: g.nationality ?? null,
    created_at: g.createdAt, updated_at: g.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, firstName: r.first_name as string, lastName: r.last_name as string,
    email: opt<string>(r.email), phone: opt<string>(r.phone), documentId: opt<string>(r.document_id),
    nationality: opt<string>(r.nationality),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

const reservationMapper: RowMapper<Reservation> = {
  table: "reservations",
  toRow: (x) => ({
    id: x.id, property_id: x.propertyId, guest_id: x.guestId, room_id: x.roomId ?? null,
    room_type_id: x.roomTypeId, check_in: x.checkIn, check_out: x.checkOut, status: x.status,
    rate_per_night: x.ratePerNight, currency: x.currency, notes: x.notes ?? null,
    created_at: x.createdAt, updated_at: x.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, propertyId: r.property_id as ID, guestId: r.guest_id as ID,
    roomId: opt<ID>(r.room_id), roomTypeId: r.room_type_id as ID,
    checkIn: r.check_in as string, checkOut: r.check_out as string,
    status: r.status as Reservation["status"], ratePerNight: r.rate_per_night as number,
    currency: r.currency as string, notes: opt<string>(r.notes),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

const invoiceMapper: RowMapper<Invoice> = {
  table: "invoices",
  toRow: (i) => ({
    id: i.id, reservation_id: i.reservationId, status: i.status, currency: i.currency,
    total: i.total, created_at: i.createdAt, updated_at: i.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, reservationId: r.reservation_id as ID, status: r.status as Invoice["status"],
    currency: r.currency as string, total: r.total as number,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

const paymentMapper: RowMapper<Payment> = {
  table: "payments",
  toRow: (p) => ({
    id: p.id, invoice_id: p.invoiceId, method: p.method, amount: p.amount,
    reference: p.reference ?? null, created_at: p.createdAt, updated_at: p.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, invoiceId: r.invoice_id as ID, method: r.method as Payment["method"],
    amount: r.amount as number, reference: opt<string>(r.reference),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

const housekeepingMapper: RowMapper<HousekeepingTask> = {
  table: "housekeeping_tasks",
  toRow: (t) => ({
    id: t.id, room_id: t.roomId, assigned_to: t.assignedTo ?? null, status: t.status,
    scheduled_for: t.scheduledFor, notes: t.notes ?? null, created_at: t.createdAt, updated_at: t.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, roomId: r.room_id as ID, assignedTo: opt<ID>(r.assigned_to),
    status: r.status as HousekeepingTask["status"], scheduledFor: r.scheduled_for as string,
    notes: opt<string>(r.notes), createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

const accessKeyMapper: RowMapper<AccessKeyRecord> = {
  table: "access_keys",
  toRow: (k) => ({
    id: k.id, room_id: k.roomId ?? null, holder_id: k.holderId, provider: k.provider,
    medium: k.medium, valid_from: k.validFrom, valid_until: k.validUntil,
    revoked: k.revoked ? 1 : 0, created_at: k.createdAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, roomId: opt<ID>(r.room_id), holderId: r.holder_id as ID,
    provider: r.provider as string, medium: r.medium as AccessKeyRecord["medium"],
    validFrom: r.valid_from as string, validUntil: r.valid_until as string,
    revoked: Boolean(r.revoked), createdAt: r.created_at as string,
  }),
};

const accessEventMapper: RowMapper<AccessEvent> = {
  table: "access_events",
  toRow: (e) => ({
    id: e.id, key_id: e.keyId ?? null, room_id: e.roomId ?? null,
    action: e.action, detail: e.detail ?? null, created_at: e.createdAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, keyId: opt<ID>(r.key_id), roomId: opt<ID>(r.room_id),
    action: r.action as AccessEvent["action"], detail: opt<string>(r.detail),
    createdAt: r.created_at as string,
  }),
};

// Role / User base mappers (their array relations live in join tables, handled below).
const roleMapper: RowMapper<Role> = {
  table: "roles",
  toRow: (x) => ({
    id: x.id, name: x.name, description: x.description, created_at: x.createdAt, updated_at: x.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, name: r.name as Role["name"], description: r.description as string,
    permissions: [], createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

const userMapper: RowMapper<User> = {
  table: "users",
  toRow: (u) => ({
    id: u.id, username: u.username, display_name: u.displayName, email: u.email ?? null,
    active: u.active ? 1 : 0, created_at: u.createdAt, updated_at: u.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as ID, username: r.username as string, displayName: r.display_name as string,
    email: opt<string>(r.email), roleIds: [], active: Boolean(r.active),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

// ── Repositories with relation handling ────────────────────────────────────

class SqliteRoleRepository extends SqliteRepository<Role> implements RoleRepository {
  constructor(db: Database) { super(db, roleMapper); }

  private async loadPermissions(roleId: ID): Promise<string[]> {
    const rows = await this.db.query<{ permission: string }>(
      `SELECT permission FROM role_permissions WHERE role_id = ?`, [roleId]);
    return rows.map((r) => r.permission);
  }

  override async getById(id: ID): Promise<Role | null> {
    const role = await super.getById(id);
    if (role) role.permissions = await this.loadPermissions(role.id);
    return role;
  }

  override async list(): Promise<Role[]> {
    const roles = await super.list();
    for (const role of roles) role.permissions = await this.loadPermissions(role.id);
    return roles;
  }

  override async save(role: Role): Promise<Role> {
    await super.save(role);
    await this.db.query(`DELETE FROM role_permissions WHERE role_id = ?`, [role.id]);
    for (const permission of role.permissions) {
      await this.db.query(
        `INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)`, [role.id, permission]);
    }
    return role;
  }
}

class SqliteUserRepository extends SqliteRepository<User> implements UserRepository {
  constructor(db: Database) { super(db, userMapper); }

  private async loadRoleIds(userId: ID): Promise<ID[]> {
    const rows = await this.db.query<{ role_id: string }>(
      `SELECT role_id FROM user_roles WHERE user_id = ?`, [userId]);
    return rows.map((r) => r.role_id);
  }

  override async getById(id: ID): Promise<User | null> {
    const user = await super.getById(id);
    if (user) user.roleIds = await this.loadRoleIds(user.id);
    return user;
  }

  override async list(): Promise<User[]> {
    const users = await super.list();
    for (const user of users) user.roleIds = await this.loadRoleIds(user.id);
    return users;
  }

  override async save(user: User): Promise<User> {
    await super.save(user);
    await this.db.query(`DELETE FROM user_roles WHERE user_id = ?`, [user.id]);
    for (const roleId of user.roleIds) {
      await this.db.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [user.id, roleId]);
    }
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    const rows = await this.db.query<Row>(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!rows[0]) return null;
    const user = userMapper.fromRow(rows[0]);
    user.roleIds = await this.loadRoleIds(user.id);
    return user;
  }

  async findCredentials(
    username: string
  ): Promise<{ user: User; passwordHash: string } | null> {
    const rows = await this.db.query<Row>(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!rows[0]) return null;
    const user = userMapper.fromRow(rows[0]);
    user.roleIds = await this.loadRoleIds(user.id);
    return { user, passwordHash: (rows[0].password_hash as string) ?? "" };
  }

  async setPasswordHash(userId: ID, passwordHash: string): Promise<void> {
    await this.db.query(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [
      passwordHash,
      new Date().toISOString(),
      userId,
    ]);
  }
}

class SqliteReservationRepository
  extends SqliteRepository<Reservation>
  implements ReservationRepository
{
  constructor(db: Database) { super(db, reservationMapper); }

  async findByGuest(guestId: ID): Promise<Reservation[]> {
    const rows = await this.db.query<Row>(
      `SELECT * FROM reservations WHERE guest_id = ?`, [guestId]);
    return rows.map((r) => reservationMapper.fromRow(r));
  }
}

class SqliteAccessKeyRepository
  extends SqliteRepository<AccessKeyRecord>
  implements AccessKeyRepository
{
  constructor(db: Database) { super(db, accessKeyMapper); }

  async setSecret(keyId: ID, ciphertext: string): Promise<void> {
    await this.db.query(`UPDATE access_keys SET secret = ? WHERE id = ?`, [ciphertext, keyId]);
  }

  async getSecret(keyId: ID): Promise<string | null> {
    const rows = await this.db.query<{ secret: string | null }>(
      `SELECT secret FROM access_keys WHERE id = ?`, [keyId]);
    return rows[0]?.secret ?? null;
  }
}

/** Build the full DataContext backed by a SQLite `Database`. */
export function createDataContext(db: Database): DataContext {
  return {
    users: new SqliteUserRepository(db),
    roles: new SqliteRoleRepository(db),
    properties: new SqliteRepository(db, propertyMapper) as PropertyRepository,
    rooms: new SqliteRepository(db, roomMapper) as RoomRepository,
    roomTypes: new SqliteRepository(db, roomTypeMapper) as RoomTypeRepository,
    guests: new SqliteRepository(db, guestMapper) as GuestRepository,
    reservations: new SqliteReservationRepository(db),
    invoices: new SqliteRepository(db, invoiceMapper) as InvoiceRepository,
    payments: new SqliteRepository(db, paymentMapper) as PaymentRepository,
    housekeeping: new SqliteRepository(db, housekeepingMapper) as HousekeepingRepository,
    accessKeys: new SqliteAccessKeyRepository(db),
    accessEvents: new SqliteRepository(db, accessEventMapper) as AccessEventRepository,
  };
}
