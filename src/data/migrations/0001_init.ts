import type { Migration } from "../db.ts";

/**
 * Migration 0001 — initial schema.
 *
 * Target: SQLite (desktop). Kept ANSI-ish so it can port to Postgres in the cloud.
 * Money is stored in MINOR units (e.g. cents) as INTEGER to avoid float errors.
 *
 * `schema_migrations` itself is created by the migration runner (see ../db.ts),
 * and `PRAGMA foreign_keys` is set per-connection by SqliteDatabase.
 */
export const migration0001: Migration = {
  version: "0001",
  sql: /* sql */ `
-- ── Auth / Users / Roles ─────────────────────────────────────────────────
CREATE TABLE roles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE role_permissions (
  role_id     TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission  TEXT NOT NULL,
  PRIMARY KEY (role_id, permission)
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  email         TEXT,
  password_hash TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ── Property / Rooms ─────────────────────────────────────────────────────
CREATE TABLE properties (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('hotel','guesthouse')),
  address    TEXT,
  timezone   TEXT NOT NULL DEFAULT 'UTC',
  currency   TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE room_types (
  id            TEXT PRIMARY KEY,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  base_price    INTEGER NOT NULL DEFAULT 0,
  max_occupancy INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (property_id, code)
);

CREATE TABLE rooms (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id TEXT NOT NULL REFERENCES room_types(id),
  number       TEXT NOT NULL,
  floor        TEXT,
  status       TEXT NOT NULL DEFAULT 'available'
               CHECK (status IN ('available','occupied','dirty','out_of_service')),
  door_external_ref TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (property_id, number)
);

-- ── Guests ───────────────────────────────────────────────────────────────
CREATE TABLE guests (
  id          TEXT PRIMARY KEY,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  document_id TEXT,
  nationality TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Reservations ─────────────────────────────────────────────────────────
CREATE TABLE reservations (
  id            TEXT PRIMARY KEY,
  property_id   TEXT NOT NULL REFERENCES properties(id),
  guest_id      TEXT NOT NULL REFERENCES guests(id),
  room_id       TEXT REFERENCES rooms(id),
  room_type_id  TEXT NOT NULL REFERENCES room_types(id),
  check_in      TEXT NOT NULL,
  check_out     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'tentative'
                CHECK (status IN ('tentative','confirmed','checked_in','checked_out','cancelled','no_show')),
  rate_per_night INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reservations_guest ON reservations(guest_id);
CREATE INDEX idx_reservations_dates ON reservations(check_in, check_out);

-- ── Billing / Payments ───────────────────────────────────────────────────
CREATE TABLE invoices (
  id             TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','void')),
  currency       TEXT NOT NULL DEFAULT 'USD',
  total          INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invoice_items (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE payments (
  id         TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  method     TEXT NOT NULL CHECK (method IN ('cash','card','transfer','other')),
  amount     INTEGER NOT NULL,
  reference  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Housekeeping ─────────────────────────────────────────────────────────
CREATE TABLE housekeeping_tasks (
  id            TEXT PRIMARY KEY,
  room_id       TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  assigned_to   TEXT REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','done','inspected')),
  scheduled_for TEXT NOT NULL,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Access (brand-neutral) ───────────────────────────────────────────────
CREATE TABLE access_keys (
  id          TEXT PRIMARY KEY,
  room_id     TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  holder_id   TEXT NOT NULL,
  provider    TEXT NOT NULL DEFAULT 'noop',
  medium      TEXT NOT NULL CHECK (medium IN ('pin','card','mobile','virtual')),
  valid_from  TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE access_events (
  id          TEXT PRIMARY KEY,
  key_id      TEXT REFERENCES access_keys(id) ON DELETE SET NULL,
  room_id     TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
};
