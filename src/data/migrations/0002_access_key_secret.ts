import type { Migration } from "../db.ts";

/**
 * Migration 0002 — store an (encrypted) credential secret on access keys.
 *
 * The column holds AES-256-GCM ciphertext (see src/data/crypto.ts), never the
 * plaintext PIN/card token. Decryption happens only via an authorized reveal.
 */
export const migration0002: Migration = {
  version: "0002",
  sql: /* sql */ `
ALTER TABLE access_keys ADD COLUMN secret TEXT;
`,
};
