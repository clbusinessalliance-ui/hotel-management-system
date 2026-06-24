/**
 * PMS Core orchestration root.
 *
 * `PmsCore` is the single object the host (Electron main, later a cloud API)
 * constructs and hands to the presentation layer. It bundles the injected
 * dependencies — data repositories and the Access Engine — WITHOUT knowing
 * which concrete database or door vendor is behind them.
 */

import type { DataContext } from "@data/repositories.ts";
import type { AccessEngine } from "@access/AccessEngine.ts";

export interface PmsDependencies {
  data: DataContext;
  access: AccessEngine;
}

export class PmsCore {
  readonly data: DataContext;
  readonly access: AccessEngine;

  constructor(deps: PmsDependencies) {
    this.data = deps.data;
    this.access = deps.access;
  }

  /** Lightweight health/info snapshot for diagnostics and the UI status bar. */
  info(): { version: string; doorProvider: string } {
    return { version: "0.1.0", doorProvider: this.access.providerName };
  }
}

export type { DataContext } from "@data/repositories.ts";
