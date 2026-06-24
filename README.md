# Hotel & Guesthouse Management System

A professional Property Management System (PMS) for hotels and guesthouses.
**Desktop-first**, **cloud-ready**, and **lock-brand agnostic** by design.

> Status: **initial project structure (scaffold)**. Domain logic is stubbed; the folder
> boundaries and interface layers are in place. See [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Tech stack

| Layer            | Choice                                      | Why                                            |
| ---------------- | ------------------------------------------- | ---------------------------------------------- |
| Desktop shell    | **Electron**                                | Native Windows/macOS/Linux desktop app         |
| UI               | **React + TypeScript + Vite**               | Fast, typed, reusable on web/cloud later       |
| Domain core      | **Pure TypeScript**                         | No UI/vendor coupling → portable to cloud API  |
| Local storage    | **SQLite** (schema-first; driver added later)| File-based, zero-config desktop DB             |
| Tests            | **Vitest**                                  | Fast unit tests for the domain core            |

The domain core is framework-free so it can later run behind a cloud API unchanged.

## Project layout

```
src/
├── core/        PMS domain modules — NO lock brand, NO vendor PMS dependency
│   ├── pms/             orchestration / use-case wiring
│   ├── auth/            authentication, users, roles, permissions
│   ├── property/        property (hotel/guesthouse) management
│   ├── rooms/           room & room-type management
│   ├── guests/          guest profiles
│   ├── reservations/    bookings / stays
│   ├── billing/         folios, invoices, payments
│   ├── housekeeping/    cleaning tasks & room status
│   └── reports/         reporting / analytics
├── access/      Access Engine + Door Provider INTERFACE (ports)
│   └── adapters/        provider adapters — ONLY place vendor lock code may live
├── shared/      shared types & utilities
├── data/        database schema, migrations, repository interfaces
│   ├── db.ts           Database port + driver-agnostic migration runner
│   ├── repositories.ts repository PORT interfaces (DataContext)
│   ├── migrations/     versioned schema migrations (TypeScript)
│   └── sqlite/         SQLite implementation: driver, repos, seed, bootstrap
├── main/        Electron main process (composition root)
└── renderer/    React desktop UI shell + navigation
```

## Database (local SQLite)

The domain depends only on the `Database` and repository **interfaces** in `src/data/`. The
concrete implementation lives in [`src/data/sqlite/`](src/data/sqlite/) using `better-sqlite3`:

- **Lifecycle:** `initDatabase()` opens the connection, runs pending migrations, and (in dev)
  loads seed data. The Electron main process owns the handle and closes it on quit.
- **Migrations:** versioned in `src/data/migrations/`, applied by a driver-agnostic runner
  that records progress in `schema_migrations`.
- **Seed:** idempotent dev sample data (one property, rooms, a guest, a reservation, an admin user).

Swapping SQLite for a cloud HTTP API later means providing new classes that satisfy the same
interfaces — no domain changes.

## Renderer data access (typed IPC)

The renderer never touches SQLite or Node directly. It calls read-only methods on `window.pms`,
a typed bridge exposed by the preload script over Electron IPC:

- **Contract:** [`src/shared/ipc/contract.ts`](src/shared/ipc/contract.ts) — one transport-neutral
  source of truth (channels + `PmsBridge` types) shared by both sides.
- **Use-cases:** [`src/core/pms/queries.ts`](src/core/pms/queries.ts) — read-only reads/counts over
  repositories (no business rules).
- **Main:** [`src/main/ipc.ts`](src/main/ipc.ts) maps each channel to a use-case; the main process
  owns the database.
- **Renderer:** [`src/renderer/pmsClient.ts`](src/renderer/pmsClient.ts) wraps the bridge and
  degrades gracefully when run in a plain browser (no Electron).

The Dashboard tab renders seeded counts fetched this way — a verification slice, not a full screen.

## Getting started

```bash
npm install        # install dependencies
npm run typecheck  # type-check the domain + UI + main process
npm test           # run unit + SQLite integration tests (Vitest)
npm run db:smoke   # headless: open SQLite, migrate, seed, read back
npm run build      # build the renderer (UI) bundle
npm run build:main # bundle the Electron main process (esbuild)
npm run dev        # run the UI in a browser (Vite dev server)
npm run rebuild    # rebuild native better-sqlite3 for Electron's ABI (see note)
npm start          # build main + launch the Electron desktop app
```

> **Native module note:** `better-sqlite3` is a native addon compiled for a specific ABI.
> Tests, `db:smoke`, and tooling run on Node and use the Node build. Before launching the
> desktop app (`npm start`), run `npm run rebuild` once to rebuild it for Electron's ABI.
> (Run `npm install` again afterwards to restore the Node build for tests.)

## Door access — important

This project does **not** implement TTLock or any real lock brand yet. All door operations go
through the brand-neutral `DoorProvider` interface in `src/access/`. The only implementation
today is `NoopDoorProvider` (a safe stub). Real vendor SDKs/DLLs/APIs are added later as
adapters under `src/access/adapters/` — without changing the PMS core. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md).
