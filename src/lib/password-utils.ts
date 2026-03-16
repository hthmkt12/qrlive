// Password hashing utilities using Web Crypto API
// Works in both browser (SubtleCrypto) and Deno edge functions

/** Generate a random salt string using UUID */
export function generateSalt(): string {
  return crypto.randomUUID();
}

/**
 * Hash a password using SHA-256 with the provided salt.
 * Input is: salt + password (concatenated before hashing).
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a plaintext password against a stored hash + salt.
 * Returns true if the password matches.
 */
export async function verifyPassword(
  password: string,
  salt: string,
  hash: string
): Promise<boolean> {
  const computed = await hashPassword(password, salt);
  return computed === hash;
}
