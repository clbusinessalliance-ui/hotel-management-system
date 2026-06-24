/**
 * Master key management for field encryption.
 *
 * The 32-byte AES key is unique per install and never lives in source control:
 *   • generated with a CSPRNG the first time it's needed,
 *   • stored under the app's userData dir, wrapped by the OS keychain via
 *     Electron `safeStorage` (Keychain on macOS, DPAPI on Windows, libsecret on
 *     Linux),
 *   • reused on every subsequent launch so existing ciphertext keeps decrypting.
 *
 * If the OS has no secure storage backend (some headless Linux), we fall back to
 * a per-install random key file with 0600 perms and log a warning — still unique
 * per install, just not OS-wrapped.
 */

import { app, safeStorage } from "electron";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEY_FILE = "field-master.key";

export function loadOrCreateMasterKey(): Buffer {
  const path = join(app.getPath("userData"), KEY_FILE);
  const secure = safeStorage.isEncryptionAvailable();

  if (existsSync(path)) {
    const blob = readFileSync(path);
    const b64 = secure ? safeStorage.decryptString(blob) : blob.toString("utf8");
    return Buffer.from(b64, "base64");
  }

  const key = randomBytes(32);
  const b64 = key.toString("base64");
  if (secure) {
    writeFileSync(path, safeStorage.encryptString(b64));
  } else {
    writeFileSync(path, b64, "utf8");
    console.warn(`[pms] OS secure storage unavailable — master key stored unwrapped at ${path}`);
  }
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best effort on platforms without POSIX perms */
  }
  console.log(`[pms] field-encryption master key ready (${secure ? "OS-wrapped" : "unwrapped"})`);
  return key;
}
