// Password hashing utilities using Web Crypto PBKDF2
// Works in both browser (SubtleCrypto) and Deno edge functions
//
// New scheme: PBKDF2-HMAC-SHA256, 600 000 iterations (OWASP 2023 guidance).
// Hash format: "pbkdf2:sha256:<iterations>:<salt-base64>:<hash-base64>"
//   — self-describing, no schema migration needed.
//
// Legacy scheme (kept for backward compat):
//   SHA-256(salt + password) stored as 64-char hex, with separate password_salt column.
//   Detected by: hash does NOT start with "pbkdf2:".

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023: ≥600 000 for PBKDF2-HMAC-SHA256
const HASH_BYTES = 32; // 256-bit derived key

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert ArrayBuffer to URL-safe base64 */
function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Convert base64 string back to Uint8Array */
function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Constant-time comparison of two equal-length Uint8Arrays.
 * Returns true only if every byte matches.
 * Timing is independent of where the first difference occurs.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ─── PBKDF2 (new scheme) ─────────────────────────────────────────────────────

/**
 * Hash a password using PBKDF2-HMAC-SHA256.
 * Returns a self-describing string:
 *   "pbkdf2:sha256:600000:<salt-base64>:<hash-base64>"
 *
 * The salt is embedded in the output — no separate salt column needed.
 */
export async function hashPassword(password: string): Promise<string> {
  const saltArr = new Uint8Array(16);
  crypto.getRandomValues(saltArr);
  const saltBuf = saltArr.buffer as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuf, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    HASH_BYTES * 8,
  );
  return `pbkdf2:sha256:${PBKDF2_ITERATIONS}:${bufToBase64(saltBuf)}:${bufToBase64(derived)}`;
}

/**
 * Verify a password against a stored hash.
 *
 * Supports both:
 * - **New (PBKDF2)**: hash starts with "pbkdf2:" — salt/iterations embedded.
 * - **Legacy (SHA-256)**: 64-char hex string — requires separate `legacySalt`.
 *
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @returns `true` if password matches.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  legacySalt?: string | null,
): Promise<boolean> {
  if (storedHash.startsWith("pbkdf2:")) {
    return verifyPBKDF2(password, storedHash);
  }
  // Legacy SHA-256 path
  if (!legacySalt) return false;
  return verifyLegacySHA256(password, legacySalt, storedHash);
}

/**
 * Returns true if the stored hash uses the legacy SHA-256 scheme
 * (i.e., it needs to be rehashed to PBKDF2 on next successful login).
 */
export function isLegacyHash(storedHash: string): boolean {
  return !storedHash.startsWith("pbkdf2:");
}

// ─── Internal: PBKDF2 verify ─────────────────────────────────────────────────

async function verifyPBKDF2(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  // Expected: ["pbkdf2", "sha256", iterations, salt-b64, hash-b64]
  if (parts.length !== 5) return false;
  const iterations = parseInt(parts[2], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = base64ToBuf(parts[3]);
  const expected = base64ToBuf(parts[4]);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
      keyMaterial,
      expected.length * 8,
    ),
  );
  return constantTimeEqual(derived, expected);
}

// ─── Internal: Legacy SHA-256 verify ─────────────────────────────────────────

async function verifyLegacySHA256(
  password: string,
  salt: string,
  storedHex: string,
): Promise<boolean> {
  const data = new TextEncoder().encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const computed = new Uint8Array(hashBuffer);

  // Convert stored hex to Uint8Array for constant-time comparison
  const expected = hexToBytes(storedHex);
  return constantTimeEqual(computed, expected);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
