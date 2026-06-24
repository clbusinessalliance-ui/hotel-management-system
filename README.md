# Hotel & Guesthouse Management System

A professional Property Management System (PMS) for hotels and guesthouses.
**Desktop-first**, **cloud-ready**, and **lock-brand agnostic** by design.

> Status: **working desktop application.** The domain core is implemented and covered
> by an automated test suite (unit + SQLite integration). The folder boundaries and
> interface layers described in [`ARCHITECTURE.md`](./ARCHITECTURE.md) are in place and
> enforced.

## Tech stack

| Layer            | Choice                                       | Why                                            |
| ---------------- | -------------------------------------------- | ---------------------------------------------- |
| Desktop shell    | **Electron**                                 | Native Windows/macOS/Linux desktop app         |
| UI               | **React + TypeScript + Vite**                | Fast, typed, reusable on web/cloud later       |
| Domain core      | **Pure TypeScript**                          | No UI/vendor coupling → portable to cloud API  |
| Local storage    | **SQLite** (`better-sqlite3`)                | File-based, zero-config desktop DB             |
| Tests            | **Vitest**                                   | Fast unit + integration tests                  |
| Main bundling    | **esbuild**                                  | Bundles the Electron main/preload to CommonJS  |

The domain core is framework-free so it can later run behind a cloud API unchanged.

## Project layout

```
src/
├── core/        PMS domain modules — NO lock brand, NO vendor PMS dependency
│   ├── pms/             orchestration (PmsCore) + commands (writes) + queries (reads)
│   ├── auth/            role-based permission model
│   ├── property/        property (hotel/guesthouse) validation
│   ├── rooms/           room status state machine & bookability
│   ├── guests/          guest profile validation
│   ├── reservations/    booking lifecycle, overlap/conflict detection, quoting
│   ├── billing/         invoice totals, payments, balances, refunds
│   ├── housekeeping/    cleaning task state machine
│   └── reports/         occupancy, revenue, arrivals/departures, status counts
├── access/      Access Engine + Door Provider INTERFACE (ports)
│   └── adapters/        provider adapters — ONLY place vendor lock code may live
├── shared/      shared types, IPC contract & utilities (transport-neutral)
│   ├── types/          domain entity types + Result<T>
│   ├── ipc/            typed IPC contract (channels + PmsBridge surface)
│   └── utils/          pure helpers
├── data/        database port, repositories, crypto, migrations
│   ├── db.ts           Database port + driver-agnostic migration runner
│   ├── repositories.ts repository PORT interfaces (DataContext)
│   ├── auth.ts         password hashing (scrypt) — Node only
│   ├── crypto.ts       AES-256-GCM field cipher for data at rest — Node only
│   ├── migrations/     versioned schema migrations (TypeScript)
│   └── sqlite/         SQLite implementation: driver, repos, seed, smoke
├── main/        Electron main process (composition root)
└── renderer/    React desktop UI shell + navigation panels
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full layered design and the rules that
keep the domain core free of UI and lock-vendor dependencies.

## Requirements

- **Node.js 20+** (developed and verified on Node 22)
- **npm 10+**
- **Windows build tools** for the native `better-sqlite3` addon (see the Windows guide below).

## Quick start (any platform)

```bash
npm install        # install dependencies
npm run typecheck  # type-check the domain + UI + main process
npm test           # run unit + SQLite integration tests (Vitest)
npm run db:smoke   # headless: open SQLite, migrate, seed, read back
npm run build      # build the renderer (UI) bundle
npm start          # rebuild native addon for Electron, build, launch the desktop app
```

> **Native module note:** `better-sqlite3` is a native addon compiled for a specific ABI.
> Tests, `db:smoke`, and tooling run on **Node** and use the Node build. `npm start` runs
> `npm run rebuild` first (via `prestart`) to recompile the addon for **Electron's** ABI.
> After running the desktop app, run `npm run rebuild:node` (or `npm install`) once to
> restore the Node build before running tests again. See the troubleshooting note below.

---

## Running on Windows (step by step)

These steps take a new machine from zero to a running desktop app.

### 1. Install prerequisites

1. Install **Node.js 20 or newer** (LTS recommended) from <https://nodejs.org>. This also
   installs npm.
2. The app uses the native `better-sqlite3` addon. Recent Node installers include the
   needed C++ build tools, but if `npm install` fails to compile it, install the
   **"Desktop development with C++"** workload from
   [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   (or run `npm install --global windows-build-tools` from an elevated PowerShell on older setups).

Verify the toolchain in **PowerShell** or **Command Prompt**:

```powershell
node -v   # should print v20.x or newer
npm -v    # should print 10.x or newer
```

### 2. Install dependencies

From the project root:

```powershell
npm install
```

This compiles `better-sqlite3` for your Node version. If it fails, fix the C++ build tools
above and re-run `npm install`.

### 3. Verify the build (recommended before first run)

Run these in order; each should exit without errors:

```powershell
npm run typecheck   # TypeScript type-checking (UI/domain + Electron main)
npm test            # unit + integration tests via Vitest
npm run build       # production renderer (UI) bundle → dist/renderer
npm run db:smoke    # opens SQLite, runs migrations, seeds, reads data back
```

`npm run db:smoke` should finish with `SQLite smoke OK ✓`. As a shortcut, `npm run verify`
runs typecheck + test + build together.

### 4. Launch the desktop app

```powershell
npm start
```

`npm start` will:

1. **`prestart`** → `npm run rebuild` — recompile `better-sqlite3` for **Electron's** ABI.
2. `npm run build` — bundle the React renderer.
3. `npm run build:main` — bundle the Electron main + preload (esbuild → `dist/main`).
4. `electron .` — open the desktop window.

On first run the app creates its SQLite database under your Windows user-data folder
(`%APPDATA%\<app>\hotel.sqlite`) and, in development, loads sample seed data.

### 5. Switching back to running tests

The desktop app needs the **Electron** build of `better-sqlite3`; the tests need the
**Node** build. After `npm start`, restore the Node build before testing again:

```powershell
npm run rebuild:node   # or: npm install
npm test
```

### Windows troubleshooting

| Symptom | Fix |
| --- | --- |
| `npm install` fails compiling `better-sqlite3` | Install the **Desktop development with C++** workload (VS Build Tools), then re-run `npm install`. |
| Tests fail with a native module / `NODE_MODULE_VERSION` mismatch after `npm start` | Run `npm run rebuild:node` to restore the Node ABI build. |
| `npm start` fails with a native module / ABI mismatch | Run `npm run rebuild` (Electron ABI) — `prestart` does this automatically; run it manually if needed. |
| App window is blank | Ensure `npm run build` succeeded so `dist/renderer/index.html` exists. |

---

## npm scripts reference

| Script | What it does |
| --- | --- |
| `npm run dev` | Run the renderer UI in a browser via the Vite dev server. |
| `npm run typecheck` | Type-check the UI/domain (`tsconfig.json`) and the Electron main (`tsconfig.main.json`). |
| `npm test` | Run the full Vitest suite once (unit + SQLite integration). |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run build` | Build the production renderer bundle → `dist/renderer`. |
| `npm run build:main` | Bundle the Electron main + preload (esbuild) → `dist/main`. |
| `npm run build:all` | `typecheck` + `build` + `build:main`. |
| `npm run db:smoke` | Headless DB check: open SQLite, migrate, seed, read back. |
| `npm run verify` | Convenience: `typecheck` + `test` + `build` (no native rebuild). |
| `npm run rebuild` | Recompile `better-sqlite3` for **Electron's** ABI (run before `npm start`). |
| `npm run rebuild:node` | Recompile `better-sqlite3` for **Node's** ABI (run before tests). |
| `npm start` | `prestart` rebuild → build renderer + main → launch Electron. |

## Database (local SQLite)

The domain depends only on the `Database` and repository **interfaces** in `src/data/`. The
concrete implementation lives in [`src/data/sqlite/`](src/data/sqlite/) using `better-sqlite3`:

- **Lifecycle:** `initDatabase()` opens the connection, runs pending migrations, and (in dev)
  loads seed data. The Electron main process owns the handle and closes it on quit.
- **Migrations:** versioned in [`src/data/migrations/`](src/data/migrations/), applied by a
  driver-agnostic runner that records progress in `schema_migrations`.
- **Seed:** idempotent dev sample data (one property, rooms, a guest, a reservation, an admin user).

Swapping SQLite for a cloud HTTP API later means providing new classes that satisfy the same
interfaces — no domain changes.

## Security at rest

- **Passwords** are hashed with **scrypt** (unique per-user salt, self-describing
  `scrypt:v1:...` format) in [`src/data/auth.ts`](src/data/auth.ts). Legacy hashes are still
  verified and transparently upgraded on next login.
- **Sensitive fields** (e.g. access-key secrets) are encrypted with **AES-256-GCM** in
  [`src/data/crypto.ts`](src/data/crypto.ts), keyed by a per-install master key obtained from
  the OS keychain — no key material in source.

These modules use `node:crypto` and live in the data layer; they are never imported by the
renderer or the pure domain core.

## Renderer data access (typed IPC)

The renderer never touches SQLite or Node directly. It calls methods on `window.pms`, a typed
bridge exposed by the preload script over Electron IPC:

- **Contract:** [`src/shared/ipc/contract.ts`](src/shared/ipc/contract.ts) — one transport-neutral
  source of truth (channels + `PmsBridge` types) shared by both sides.
- **Use-cases:** [`src/core/pms/queries.ts`](src/core/pms/queries.ts) (reads) and
  [`src/core/pms/commands.ts`](src/core/pms/commands.ts) (writes / business rules).
- **Main:** [`src/main/ipc.ts`](src/main/ipc.ts) maps each channel to a use-case; the main process
  owns the database.
- **Renderer:** [`src/renderer/pmsClient.ts`](src/renderer/pmsClient.ts) wraps the bridge and
  degrades gracefully when run in a plain browser (no Electron).

## Door access — important

This project does **not** implement TTLock or any real lock brand yet. All door operations go
through the brand-neutral `DoorProvider` interface in `src/access/`. The only implementation
today is `NoopDoorProvider` (a safe stub). Real vendor SDKs/DLLs/APIs are added later as
adapters under `src/access/adapters/` — without changing the PMS core. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md).
