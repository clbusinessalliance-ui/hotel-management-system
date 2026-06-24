# Architecture

Hotel & Guesthouse Management System — **desktop-first, cloud-ready, lock-brand agnostic.**

## Goals & hard rules

1. **PMS Core never depends on any lock brand.** The core talks to doors only through
   the `DoorProvider` interface (a *port*). It must compile and run with zero lock vendors present.
2. **Door access is isolated behind a provider/interface layer.** Concrete vendor code lives
   only in `src/access/adapters/` and is wired in at the edge — never imported by core modules.
3. **No supplier PMS dependency.** We do not build on top of any vendor's PMS. Vendor SDKs/DLLs/APIs
   are integrated *later* as adapters behind our interfaces.
4. **Cloud-ready.** The domain core is pure TypeScript with no Electron/DOM/Node coupling, so the
   same modules can later run behind a cloud API. Persistence sits behind repository interfaces so
   the local SQLite store can be swapped for a remote API/Postgres without touching the domain.

## Layered dependency direction

```
            ┌─────────────────────────────────────────────┐
            │  renderer/  (React UI shell + navigation)     │   <- desktop presentation
            └───────────────────────┬─────────────────────-┘
                                    │ (IPC, later: HTTP to cloud)
            ┌───────────────────────▼─────────────────────-┐
            │  main/  (Electron host, process wiring)        │   <- composition root
            └───────────────────────┬─────────────────────-┘
                                    │ injects providers + repositories
   ┌────────────────────────────────▼──────────────────────────────────┐
   │  core/  PMS domain  (auth, property, rooms, guests, reservations,  │  <- pure TypeScript
   │         billing, housekeeping, reports, pms orchestration)         │     (no UI, no vendor)
   └───────┬───────────────────────────────────────────────┬───────────┘
           │ depends on PORTS only                          │
   ┌────────▼─────────────┐                      ┌──────────▼───────────┐
   │ access/ Access Engine │                      │ data/ repositories    │
   │ + DoorProvider (port) │                      │ + schema/migrations   │
   └────────┬─────────────┘                      └───────────────────────┘
           │ implemented by
   ┌────────▼──────────────────────────────────────────────┐
   │ access/adapters/  (NoopDoorProvider today;             │  <- ONLY place vendor
   │                    TTLock / Salto / etc. LATER)         │     code may live
   └────────────────────────────────────────────────────────┘
```

**Rule of thumb:** arrows point *inward*. `core/` may import `shared/` and the access/data
*ports*. Nothing in `core/` may import anything from `access/adapters/`.

## Hybrid access-door strategy

The "Access Engine" is brand-neutral. It receives a `DoorProvider` implementation at runtime
(dependency injection from the composition root in `main/`). Today only `NoopDoorProvider`
exists (a safe in-memory stub for development and tests). Real vendors are added later by:

1. Creating `src/access/adapters/<vendor>/<Vendor>DoorProvider.ts` implementing `DoorProvider`.
2. Registering it in the composition root.

No core module changes when a vendor is added or swapped.

## Cloud migration path (later)

- **Today:** renderer ↔ Electron main ↔ in-process core ↔ local SQLite.
- **Later:** the same `core/` modules run server-side behind a REST/GraphQL API; the renderer's
  repository/gateway implementations swap from "in-process" to "HTTP". Domain code is untouched.
