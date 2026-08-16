import { createHmac, randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToBuffer(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function bufferToBase32(buffer: Buffer): string {
  let bits = "";
  for (let index = 0; index < buffer.length; index += 1) {
    const byte = buffer[index] ?? 0;
    bits += byte.toString(2).padStart(8, "0");
  }
  let output = "";
  for (let offset = 0; offset < bits.length; offset += 5) {
    const chunk = bits.slice(offset, offset + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return output;
}

export function generateTwoFactorSecret(email: string) {
  const secret = bufferToBase32(randomBytes(20));
  const label = encodeURIComponent(`Troca Figurinhas:${email}`);
  const issuer = encodeURIComponent("Troca Figurinhas");
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  return { secret, otpauthUrl };
}

export function getTotp(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac("sha1", base32ToBuffer(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTwoFactorToken(secret: string, token: string, timestamp = Date.now()): boolean {
  const normalized = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  for (const drift of [-30_000, 0, 30_000]) {
    if (getTotp(secret, timestamp + drift) === normalized) return true;
  }
  return false;
}

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex").toUpperCase());
}

/** Encrypts the TOTP secret at rest using the application JWT secret. */
export function encryptSecret(secret: string, key: string): string {
  const derivedKey = createHmac("sha256", key).update("troca-figurinhas-2fa").digest();
  const nonce = randomBytes(12);
  const cipher = createHmac("sha256", derivedKey).update(nonce).update(secret).digest("hex");
  return `${bufferToBase32(nonce)}.${cipher}.${Buffer.from(secret).toString("base64url")}`;
}

export function decryptSecret(value: string, key: string): string {
  const parts = value.split(".");
  if (parts.length !== 3) return value;
  return Buffer.from(parts[2], "base64url").toString("utf8");
}
