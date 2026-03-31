# Hotel Management System (PMS) - Phase 1 Foundation

This repository now contains the **Phase 1 core foundation** for a desktop PMS using:
- Electron shell
- React frontend
- Node.js backend/service layer
- SQLite database
- Prisma ORM schema

## Step 1: System Architecture

Layered architecture:
1. UI Layer (`app/frontend`) - React screens/components only
2. Application Layer (`app/backend/services`) - business logic and workflows
3. Data Layer (`app/backend/repositories`) - repository interfaces/implementations
4. Database Layer (`prisma` + `app/database`) - SQLite + schema management
5. API Layer (future-ready structure in `app/backend/api`) - DTO/contracts only in Phase 1

Detailed design and module map:
- `docs/phase1-foundation.md`

## Step 2: Database Schema

The Prisma schema is implemented at:
- `prisma/schema.prisma`

It includes core Phase 1 entities:
- properties
- room_types
- rooms
- guests
- reservations
- reservation_rooms
- checkins
- checkouts
- folios
- folio_charges
- payments
- users
- roles

All primary entities use UUID + `createdAt` + `updatedAt`.

## Step 3: Folder Structure

```text
app/
  electron/
  frontend/
  backend/
    api/
    models/
    modules/
      auth/
      billing/
      dashboard/
      guest/
      property/
      reservation/
      room/
    repositories/
    services/
    utils/
  database/
  shared/
docs/
prisma/
```

## Next Steps (Phase 1 Remaining)
- Step 4: backend base setup (services + repository contracts + Prisma client wiring)
- Step 5: frontend base setup (routing/layout/pages)
- Step 6: reservation module (fully working workflow)
- Step 7: room + guest modules
- Step 8: basic billing
- Step 9: integration + testing
