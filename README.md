# Hotel Management System (Electron + Backend + Frontend)

This project now has a runnable local setup with 3 app modules:

- `app/electron` → Electron desktop shell
- `app/backend` → Express API server
- `app/frontend` → Vite frontend UI

## Project Structure

```text
app/
  electron/
    main.js
    package.json
  backend/
    src/server.js
    package.json
  frontend/
    index.html
    main.js
    package.json
prisma/
docs/
```

## Requirements

- Node.js 18+
- npm 9+

## Install

From the repository root:

```bash
npm install
```

This installs dependencies for all workspaces (`app/electron`, `app/backend`, `app/frontend`).

## Run in Development (Electron + Backend + Frontend)

```bash
npm run dev
```

What happens:

- Backend runs on `http://localhost:3001`
- Frontend dev server runs on `http://localhost:5173`
- Electron waits for both services, then opens the desktop app

## Run in Start Mode

```bash
npm run build
npm run start
```

What happens:

- Frontend is built to `app/frontend/dist`
- Backend runs on `http://localhost:3001`
- Frontend preview runs on `http://localhost:4173`
- Electron waits for both services and opens the app

## Health Check Endpoint

Backend exposes:

- `GET /api/health`

The frontend automatically checks this endpoint and shows connection status.
