const PBKDF2_ITERATIONS = 600_000;
const HASH_BYTES = 32;

function bufToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuf(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = parseInt(value.substring(index, index + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) diff |= left[index] ^ right[index];
  return diff === 0;
}

export async function hashPasswordPBKDF2(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const saltBuffer = salt.buffer as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuffer, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    HASH_BYTES * 8
  );

  return `pbkdf2:sha256:${PBKDF2_ITERATIONS}:${bufToBase64(saltBuffer)}:${bufToBase64(derived)}`;
}

async function verifyPBKDF2(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
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
    ["deriveBits"]
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
      keyMaterial,
      expected.length * 8
    )
  );

  return constantTimeEqual(derived, expected);
}

async function verifyLegacySHA256(password: string, salt: string, storedHex: string): Promise<boolean> {
  const data = new TextEncoder().encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return constantTimeEqual(new Uint8Array(hashBuffer), hexToBytes(storedHex));
}

export async function verifyPassword(password: string, storedHash: string, legacySalt?: string | null) {
  if (storedHash.startsWith("pbkdf2:")) return verifyPBKDF2(password, storedHash);
  if (!legacySalt) return false;
  return verifyLegacySHA256(password, legacySalt, storedHash);
}

export function isLegacyHash(storedHash: string) {
  return !storedHash.startsWith("pbkdf2:");
}

export function buildPasswordForm(shortCode: string, errorMessage?: string): string {
  const error = errorMessage ? `<p class="error">${errorMessage}</p>` : "";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link được bảo vệ</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f0f13;color:#e2e8f0}
  .card{background:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;padding:32px;width:100%;max-width:360px}
  h1{font-size:1.2rem;margin:0 0 8px}
  p{font-size:.875rem;color:#94a3b8;margin:0 0 20px}
  .error{color:#f87171;margin-bottom:16px}
  input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #2d2d44;background:#0f0f13;color:#e2e8f0;font-size:1rem;margin-bottom:16px}
  button{width:100%;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#2dd4bf,#3b82f6);color:#fff;font-weight:600;font-size:1rem;cursor:pointer}
</style>
</head>
<body>
<div class="card">
  <h1>Link được bảo vệ</h1>
  <p>Vui lòng nhập mật khẩu để tiếp tục.</p>
  ${error}
  <form method="POST" action="">
    <input type="password" name="password" placeholder="Mật khẩu" autofocus required />
    <button type="submit">Tiếp tục</button>
  </form>
</div>
</body>
</html>`;
}
