/**
 * Field-level encryption for sensitive data at rest (Node infra — uses
 * node:crypto, so it lives in the data layer, never imported by the renderer or
 * the pure core).
 *
 * AES-256-GCM (authenticated): output is `iv:tag:ciphertext`, all base64.
 * Tampering fails decryption (auth tag check).
 *
 * The cipher is bound to a 32-byte master key supplied by the caller — there is
 * NO key material in source. The composition root obtains the key from the OS
 * keychain (see src/main/masterKey.ts) and injects this cipher's encrypt/decrypt.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface FieldCipher {
  encrypt(plain: string): string;
  decrypt(payload: string): string;
}

/** Create an AES-256-GCM field cipher bound to `key` (must be 32 bytes). */
export function createFieldCipher(key: Buffer): FieldCipher {
  if (key.length !== 32) throw new Error("Field cipher key must be 32 bytes");

  return {
    encrypt(plain: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
    },

    decrypt(payload: string): string {
      const [ivB64, tagB64, dataB64] = payload.split(":");
      if (!ivB64 || !tagB64 || dataB64 === undefined) throw new Error("Malformed ciphertext");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
      decipher.setAuthTag(Buffer.from(tagB64, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(dataB64, "base64")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
