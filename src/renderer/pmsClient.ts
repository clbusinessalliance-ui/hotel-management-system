/**
 * Renderer-side typed client for the PMS bridge.
 *
 * `window.pms` is injected by the preload script (desktop). When the renderer
 * runs in a plain browser (e.g. `npm run dev` without Electron), the bridge is
 * absent — callers should check `isBridgeAvailable()` and degrade gracefully.
 */

import type { PmsBridge } from "@shared/ipc/contract.ts";

declare global {
  interface Window {
    pms?: PmsBridge;
  }
}

export function getBridge(): PmsBridge | null {
  return typeof window !== "undefined" && window.pms ? window.pms : null;
}

export function isBridgeAvailable(): boolean {
  return getBridge() !== null;
}

export type { PmsBridge };
