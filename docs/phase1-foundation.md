# Phase 1 Core Foundation Blueprint (PMS Desktop)

## Step 1: System Architecture

### Architectural Style
Phase 1 uses a **modular layered architecture** designed for desktop-first operation and future API extraction.

```text
Electron Shell
  └── React UI (Renderer)
       └── IPC Adapters (Frontend API client)
            └── Application Services (Node backend)
                 └── Repository Layer
                      └── Prisma Data Access
                           └── SQLite
```

### Layer Responsibilities

1. **UI Layer (`app/frontend`)**
   - React pages and components only.
   - No SQL / Prisma usage.
   - Calls backend through typed IPC contract.

2. **Application Layer (`app/backend/services`)**
   - Orchestrates business use cases (reservation lifecycle, billing flow, room state updates).
   - Performs validation, policy checks, and transaction boundaries.

3. **Data Layer (`app/backend/repositories`)**
   - Encapsulates data persistence details.
   - Each module exposes repository interfaces and Prisma-backed implementations.

4. **Database Layer (`prisma` + `app/database`)**
   - SQLite for local-first performance and offline operation.
   - Prisma schema acts as source of truth for core entities.

5. **Future-ready API Layer (`app/backend/api`)**
   - Contracts and DTOs only in Phase 1.
   - Structured to later expose REST/GraphQL without changing domain logic.

### Cross-Cutting Patterns
- **UUID primary keys** for all aggregate roots and link entities.
- **Audit fields** (`createdAt`, `updatedAt`) on all business tables.
- **Service-first business rules** (UI and repos cannot bypass services).
- **State machine approach** for reservation lifecycle:
  - `reserved` → `checked_in` → `checked_out`
  - `reserved` → `cancelled`

---

## Step 1 (continued): Module Map

### Core Modules in Phase 1

1. **Property Module**
   - Manage property profile.
   - Define room types and baseline rates.

2. **Room Module**
   - Manage physical rooms.
   - Status handling: `available`, `occupied`, `dirty`, `maintenance`.

3. **Guest Module**
   - Basic CRM profile management.
   - Guest search/list/detail workflows.

4. **Reservation Module (Core)**
   - Availability checks and room assignment.
   - Reservation CRUD and lifecycle operations.
   - Check-in/check-out/extend/cancel workflows.

5. **Front Desk Module**
   - Quick booking actions.
   - Availability table view.
   - Operational check-in/check-out controls.

6. **Billing Module**
   - Folio creation and tracking.
   - Room charge posting + manual extras.
   - Cash payment and folio closure.

7. **Dashboard Module**
   - Operational counts (available, occupied, arrivals today, departures today).

8. **Auth Module**
   - Login.
   - Role-based permissions (`admin`, `front_desk`).

### Module Interaction Rules
- Reservation service updates room status and creates check-in/out records.
- Billing service depends on reservation stay data.
- Dashboard service reads from reservation + room aggregates.
- Auth controls command access, not read-only dashboards.

---

## Step 2: Database Schema Overview

### Core Design Notes
- SQLite-friendly schema with normalized entities.
- Many-to-many reservation-to-room support via `reservation_rooms`.
- Separate operational records for check-in and check-out.
- Billing separated into `folios`, `folio_charges`, and `payments` for growth.

### Lifecycle Constraints (service-enforced)
- No overlapping active reservations for the same room and date range.
- Check-in allowed only for `reserved` reservations.
- Check-out allowed only for `checked_in` reservations.
- Folio must be fully paid before final closure.

