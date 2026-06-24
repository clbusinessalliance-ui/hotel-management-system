/**
 * Electron main process — the COMPOSITION ROOT.
 *
 * This is the one place where concrete implementations are chosen and wired:
 *   • the SQLite database + repositories that back the domain
 *   • which DoorProvider adapter the Access Engine uses (today: NoopDoorProvider)
 *
 * The renderer and the PMS core never make these choices themselves.
 */

import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "node:path";

import { initDatabase } from "../data/sqlite/index.ts";
import { AccessEngine } from "../access/AccessEngine.ts";
import { NoopDoorProvider } from "../access/adapters/NoopDoorProvider.ts";
import { PmsCore } from "../core/pms/index.ts";
import { registerPmsIpc, type IpcRegistry } from "./ipc.ts";
import { loadOrCreateMasterKey } from "./masterKey.ts";
import { createFieldCipher } from "../data/crypto.ts";
import type { Database } from "../data/db.ts";

const isDev = !app.isPackaged;

let pms: PmsCore | null = null;
let database: Database | null = null;

/** Open SQLite, migrate, (in dev) seed, and assemble the PMS core. */
async function bootstrap(): Promise<void> {
  const dbPath = path.join(app.getPath("userData"), "hotel.sqlite");
  const { db, data, applied, seeded } = await initDatabase({ filename: dbPath, seed: isDev });
  database = db;

  // Door access is injected here as a brand-neutral provider. Swapping in a real
  // vendor adapter later is a one-line change at this composition root.
  const access = new AccessEngine(new NoopDoorProvider());
  pms = new PmsCore({ data, access });

  console.log(
    `[pms] SQLite connected at ${dbPath} — migrations:[${applied.join(",")}] seeded:${seeded} ` +
      `door:${access.providerName}`
  );

  // Field-encryption cipher, keyed by the per-install master key from the OS keychain.
  const cipher = createFieldCipher(loadOrCreateMasterKey());

  // Expose PMS channels to the renderer over typed IPC. ipcMain satisfies IpcRegistry structurally.
  registerPmsIpc(ipcMain as unknown as IpcRegistry, pms, cipher);
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Hotel & Guesthouse Management System",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  await bootstrap();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Close the database cleanly on shutdown.
app.on("will-quit", () => {
  void database?.close();
});
