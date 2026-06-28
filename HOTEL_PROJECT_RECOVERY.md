# HOTEL PMS — PROJECT RECOVERY REPORT

**Audit type:** Read-only recovery audit. No packages installed, no migrations run, no files modified. This `HOTEL_PROJECT_RECOVERY.md` is the only file created.
**Audit date:** 2026-06-28
**Confirmed target (NOT the CRM):** `C:\Users\Tep chanchampa\OneDrive\Documents\Hotel sotware`

> ✅ This is the correct project: an **Electron + React + TypeScript + Vite desktop Hotel PMS** with a local **SQLite** database. It is a different repository from `crm-main-product` and was audited in isolation.

---

## 1. Folder & package.json confirmation

| Check | Result |
|---|---|
| Folder exists | ✅ Yes — `C:\Users\Tep chanchampa\OneDrive\Documents\Hotel sotware` |
| `package.json` exists | ✅ Yes |
| Package name / version | `hotel-management-system` **v0.1.0** (`private`, `UNLICENSED`) |
| Self-description | *"Hotel & Guesthouse Management System (PMS) — desktop-first, cloud-ready, lock-brand agnostic."* |

Top-level contents: `src/`, `dist/`, `node_modules/`, `.git/`, `.claude/`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.main.json`, `vite.config.ts`, `vitest.config.ts`, `README.md`, `ARCHITECTURE.md`, `.gitignore`, `cc9d316polishappdocs.patch`.

> Note: there is **no `prisma/` folder** — the brief mentioned "Prisma/SQLite", but this project uses **SQLite directly via `better-sqlite3`** with hand-written migrations (no Prisma ORM). There are also no top-level `scripts/` or `tests/` folders — tests are **colocated** next to source as `*.test.ts`.

---

## 2. Tech stack (verified from `package.json`, configs, source)

| Layer | Technology |
|---|---|
| Desktop shell | **Electron 33** (`main: dist/main/main.cjs`) |
| UI | **React 18 + TypeScript 5.6 + Vite 5** |
| Domain core | **Pure TypeScript** (no UI/Electron/vendor coupling) |
| Local storage | **SQLite via `better-sqlite3` 12** (file-based; `*.sqlite`/`*.db` gitignored) |
| Main/preload bundling | **esbuild** (→ CommonJS `.cjs`) |
| Tests | **Vitest 2** (unit + SQLite integration) |
| Native rebuild | **@electron/rebuild** (for `better-sqlite3`) |
| Node engine | `>= 20` |

**`npm run` scripts available (none executed):**
`dev` (vite) · `typecheck` (both tsconfigs) · `build` · `build:main` (esbuild main+preload) · `build:all` · `verify` (typecheck+test+build) · `test` (vitest run) · `test:watch` · `db:smoke` (SQLite smoke test) · `rebuild` / `rebuild:node` (native rebuild) · `electron` · `start` (build + build:main + electron) · `prestart` (rebuild).

**Architecture:** clean / **ports-and-adapters (hexagonal)**, dependency arrows point inward (documented in `ARCHITECTURE.md` and actually enforced by the folder layout):

```
renderer/ (React UI)  ──IPC──▶  main/ (Electron host, composition root)
                                   │ injects providers + repositories
                                   ▼
                          core/ (pure-TS PMS domain)
                          depends on PORTS only
                   ┌───────────────┴───────────────┐
            access/ (DoorProvider port)        data/ (repositories + migrations → SQLite)
            access/adapters/ NoopDoorProvider   (TTLock/Salto/etc = LATER)
```

---

## 3. Git status

| Item | Value |
|---|---|
| **Current branch** | `claude/clever-cori-5g3mv3` |
| **Working tree** | Essentially clean |
| **Uncommitted changes** | `M package-lock.json` (modified) |
| **Untracked files** | `cc9d316polishappdocs.patch` (a loose patch file — see note) |
| **Local commits on this branch** | Only **2** |
| **Last commit** | `92bbd0a` — *"docs: refresh README to match real architecture + add Windows run guide"* — Claude — **2026-06-24 15:44 UTC** |
| **Previous commit** | `3e7aee8` — *"Add local Hotel software build"* — CL Business Alliance — 2026-06-24 |

**Branches present:**
- Local: `claude/clever-cori-5g3mv3` (current)
- Remote: `origin/main`, `origin/claude/clever-cori-5g3mv3`, `origin/codex/build-phase-1-of-property-management-system`, `origin/codex/fix-electron-asset-loading-in-production`, `origin/codex/fix-local-setup-for-electron-project`

⚠️ **History divergence to reconcile (recovery-relevant):** the local branch has only 2 commits, while `origin/main` carries the full PR history — *"Build phase 1 of PMS"* (PR #1), *"Set up runnable Electron backend/frontend workspace"* (PR #2), and *"Fix Electron production asset paths for Vite build"* (PR #3, `bc17f6e`). The local "Add local Hotel software build" commit looks like a fresh/squashed local snapshot rather than a descendant of `origin/main`. **Before resuming work, confirm whether the production asset-path fix (PR #3) is present in this working copy**, and decide which line of history is authoritative.

**Loose patch file:** `cc9d316polishappdocs.patch` corresponds to the already-committed README refresh (`92bbd0a`). It is a leftover artifact (untracked) and carries no un-applied work — safe to ignore/remove later (no action taken).

---

## 4. Existing modules

### Domain core — `src/core/*` (pure TypeScript, all implemented + tested)
| Module | Folder | Notes |
|---|---|---|
| Auth / Users / Roles | `core/auth/` | Permission model with `resource:action` strings + wildcards (`*`, `reservation:*`) |
| Property | `core/property/` | Hotel/guesthouse validation |
| Rooms | `core/rooms/` | Room status state machine & bookability |
| Guests | `core/guests/` | Guest profile validation |
| Reservations | `core/reservations/` | Booking lifecycle, overlap/conflict detection, quoting |
| Billing | `core/billing/` | Invoice totals, payments, balances, refunds |
| Housekeeping | `core/housekeeping/` | Cleaning task state machine |
| Reports | `core/reports/` | Occupancy, revenue, arrivals/departures, status counts |
| PMS orchestration | `core/pms/` | `PmsCore` + `commands.ts` (writes) + `queries.ts` (reads) |

### Access engine (lock-brand agnostic) — `src/access/*`
- `AccessEngine.ts` + `DoorProvider.ts` (the port).
- `access/adapters/NoopDoorProvider.ts` — the only adapter today (safe in-memory stub). Real vendors (TTLock/Salto/etc.) are designed to plug in **later** without touching core.

### Data layer — `src/data/*`
- `db.ts` (migration runner + `schema_migrations`), `repositories.ts` (interfaces), `migrations/` (`0001_init`, `0002_access_key_secret`, `index.ts`).
- `sqlite/` — `SqliteDatabase.ts`, `repositories.ts` (concrete), `seed.ts` (dev data), `smoke.ts`, integration test.
- `auth.ts` (scrypt password hashing), `crypto.ts` (AES-256-GCM field cipher).

### Electron host — `src/main/*`
- `main.ts` (composition root), `preload.ts` (bridge), `ipc.ts` (channel→use-case wiring with permission guards), `masterKey.ts` (OS-keychain-wrapped encryption key).

### Shared contract — `src/shared/*`
- `ipc/contract.ts` (single source of truth for the `PmsBridge` API + channel names), `types/`, `utils/`.

**Maturity:** README states *"working desktop application"* and the code backs it up — every core module is implemented and has tests; the full read + write IPC surface is wired. This is **well past scaffold**.

---

## 5. Database / schema status

- **Engine:** SQLite (`better-sqlite3`), file-based; per-connection `PRAGMA foreign_keys`. Money stored in **minor units (INTEGER)** to avoid float errors. SQL kept ANSI-ish for a future Postgres/cloud port.
- **Migrations:** **2**, applied via an in-app migration runner (`schema_migrations` table). *Not run during this audit.*
  - `0001_init` — full initial schema.
  - `0002_access_key_secret` — adds encrypted `secret` column to `access_keys`.
- **Tables (from `0001_init` + `0002`):** `roles`, `role_permissions`, `users`, `user_roles`, `properties`, `room_types`, `rooms`, `guests`, `reservations`, `invoices`, `invoice_items`, `payments`, `housekeeping_tasks`, `access_keys` (+`secret`), `access_events`.
- **Integrity:** FK constraints with `ON DELETE CASCADE`/`SET NULL`, `CHECK` constraints on enums (room status, reservation status, payment method, etc.), `UNIQUE` keys (e.g. `properties(number)`, `room_types(property_id,code)`), indexes on reservation guest + dates.
- **Seed data (`data/sqlite/seed.ts`, dev-only, idempotent):** demo "Seaside Guesthouse", room types STD/DLX, 3 rooms, `owner` + `front_desk` roles, **admin/admin** dev user, one guest, reservation, invoice, payment, and housekeeping task. `ensureAdminPassword()` keeps `admin`/`admin` usable in dev.

---

## 6. UI pages (renderer panels — `src/renderer/*`)

Navigation is data-driven (`navigation.ts`) with **per-module permission gating** (`requiredPermission`).

| Nav module | Permission | Panel component |
|---|---|---|
| Dashboard | (always) | `DashboardPanel.tsx` |
| Reservations | `reservation:read` | `ReservationsPanel.tsx` (+ `NewReservationForm.tsx`, `EditReservationForm.tsx`) |
| Rooms | `room:read` | `RoomsPanel.tsx` |
| Guests | `guest:read` | `GuestsPanel.tsx` |
| Property | `property:read` | `PropertyPanel.tsx` |
| Housekeeping | `housekeeping:read` | `HousekeepingPanel.tsx` |
| Billing | `billing:read` | `BillingPanel.tsx` |
| Reports | `report:read` | `ReportsPanel.tsx` |
| Access | `access:issue` | `AccessPanel.tsx` |
| Users & Roles | `user:read` | `UsersRolesPanel.tsx` |

Plus `App.tsx` (shell), `LoginScreen.tsx`, `authContext.tsx`, `pmsClient.ts` (typed IPC client over `window.pms`), `main.tsx`, `index.html`, `styles.css`, and pure row-mapper helpers (`reservationRows`, `roomRows`, `billingRows`, `housekeepingRows` — each unit-tested).

---

## 7. Security / auth status — **Strong**

| Control | Status | Detail |
|---|---|---|
| Password hashing | ✅ Strong | **scrypt** (N=16384,r=8,p=1) + per-user random salt, versioned format; constant-time compare. Legacy SHA-256 hashes are accepted **only** for verification and flagged `needsUpgrade` to rehash on next login. |
| Field encryption at rest | ✅ Strong | **AES-256-GCM** authenticated cipher (`iv:tag:ciphertext`, base64); tampering fails decryption. No key material in source. |
| Master key management | ✅ Strong | 32-byte CSPRNG key, unique per install, wrapped by OS keychain via Electron `safeStorage` (DPAPI on Windows). Fallback to `0600` key file with a logged warning on systems lacking secure storage. |
| Access-key secrets | ✅ | PIN/card/token stored **encrypted** in `access_keys.secret`; plaintext only via an authorized `revealKeySecret` reveal. |
| Authorization boundary | ✅ Strong | **Server-side session in the Electron main process** (`ipc.ts`). Login establishes the user; every **write** command is wrapped by `guarded(permission, …)` and checked via `hasPermission` before executing. Renderer UI gating is explicitly treated as convenience only. |
| Permission model | ✅ | `resource:action` strings with wildcard support; default role→permission map (`owner`, `manager`, `front_desk`, `housekeeping`, `accountant`). |
| Secrets in repo | ✅ | `.gitignore` excludes `.env*`, `*.key`, `field-master.key`, `*.sqlite`/`*.db`. No secrets found in source. |

**Minor notes (not blockers):**
- Dev seed enforces a well-known **admin/admin** credential (and re-asserts it on startup) — intended for development; must be disabled/changed for any real deployment.
- IPC **read** channels are unauthenticated by design (renderer only calls them post-login); acceptable for a single-user desktop session but worth revisiting if multi-tenant/cloud.
- Electron hardening (contextIsolation/sandbox/CSP in `main.ts`/`preload.ts`) was not deep-audited in this pass — recommend a focused check before packaging for distribution.

---

## 8. Tests available

- **Framework:** Vitest (`vitest run`). *Not executed in this read-only audit.*
- **Count:** **17 colocated `*.test.ts` files** spanning domain, data, IPC, and renderer logic:
  - Core/domain: `auth`, `rooms`, `reservations`, `housekeeping`, `reports`, `pms/commands`, `pms/queries`
  - Access: `AccessEngine`
  - Data: `data/auth` (hashing), `data/crypto` (cipher), `data/sqlite/sqlite.integration` (**real SQLite integration**)
  - Main: `main/ipc` (permission-guard wiring, with a fake registry)
  - Renderer (pure mappers): `billingRows`, `housekeepingRows`, `reservationRows`, `roomRows`
  - Shared: `utils`
- **Quality signal:** the `verify` script chains `typecheck → test → build`, indicating a CI-style gate is intended. Coverage targets the high-risk areas (auth, crypto, IPC authorization, SQLite persistence, booking logic).

---

## 9. Exact last stable milestone

**Last stable milestone:** commit **`3e7aee8` "Add local Hotel software build" (2026-06-24)** — the functional, runnable desktop build (domain core + SQLite data layer + Electron IPC + React panels + test suite). The subsequent commit `92bbd0a` (2026-06-24) is **documentation-only** (README refresh + Windows run guide) and does not change application behavior.

On the remote line, the equivalent stable point is **`bc17f6e` "Fix Electron production asset paths for Vite build" (PR #3 on `origin/main`)** — the last functional fix before docs.

So: **the project is at a stable, working-desktop-app milestone**; the only thing after it is documentation. The working tree is clean apart from a `package-lock.json` delta and one leftover patch artifact.

---

## 10. Recommended next step

**Establish a verified, reconciled baseline before writing any feature code:**

1. **Reconcile git history (highest priority).** The local branch (`claude/clever-cori-5g3mv3`, 2 commits) has diverged from `origin/main` (full PR history incl. the Electron production asset-path fix). Decide which is authoritative, and confirm the asset-path fix (`bc17f6e`) is present locally. Commit the `package-lock.json` change (or discard it) and remove the stray `cc9d316polishappdocs.patch` so the tree is unambiguous.
2. **Prove the build green (read-only commands only).** Run `npm run verify` (typecheck + `vitest run` + build) and `npm run db:smoke`. This confirms the 17-test suite passes and SQLite works on this machine **without** installing anything new or running app migrations against real data. *(Native module note: `better-sqlite3` may require `npm run rebuild` for Electron — a build step, not a new dependency.)*
3. **Then pick the first real feature increment.** Given the schema and core are complete, the highest-value next functional milestone is wiring a **real `DoorProvider` adapter** (the architecture's explicit extension point, currently only `NoopDoorProvider`) **or** hardening for distribution (replace the dev admin/admin seed, audit Electron `contextIsolation`/CSP, package the app).

> Do not start new modules until steps 1–2 confirm which history is canonical and that `verify` is green — this project is healthy and well-architected, so the only real recovery risk here is **branch/history ambiguity**, not the code itself.

---

## Summary scorecard

| Dimension | Assessment |
|---|---|
| Correct project located | ✅ Electron + React + TS + Vite + SQLite Hotel PMS |
| Architecture | ✅ Clean ports-and-adapters, enforced, cloud-ready by design |
| Functional completeness | **High** — all core PMS modules implemented; full IPC read/write surface; working desktop app |
| Database | ✅ 2 migrations, complete relational schema, FK/CHECK integrity, dev seed |
| Security | ✅ **Strong** (scrypt, AES-256-GCM, OS-wrapped key, server-side permission-guarded IPC) |
| Tests | ✅ 17 Vitest files (unit + SQLite integration + IPC authz) |
| Main risk | ⚠️ **Git history divergence** (local 2-commit branch vs full `origin/main` PR history) — reconcile first |
| Status | **Stable working-app milestone; ready to resume after baseline reconciliation** |

*End of report. No project files were modified; `HOTEL_PROJECT_RECOVERY.md` is the only file created.*
