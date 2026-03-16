import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isLegacyHash, constantTimeEqual } from "@/lib/password-utils";

// ── Legacy SHA-256 helper (for backward-compat tests) ──────────────────────
async function legacyHashSHA256(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── hashPassword (PBKDF2) ──────────────────────────────────────────────────

describe("hashPassword (PBKDF2)", () => {
  it("returns a self-describing PBKDF2 hash string", async () => {
    const hash = await hashPassword("secret");
    expect(hash).toMatch(/^pbkdf2:sha256:\d+:.+:.+$/);
  });

  it("embeds 600000 iterations", async () => {
    const hash = await hashPassword("secret");
    const parts = hash.split(":");
    expect(parts[2]).toBe("600000");
  });

  it("produces different hashes for same password (random salt)", async () => {
    const h1 = await hashPassword("same-password");
    const h2 = await hashPassword("same-password");
    expect(h1).not.toBe(h2);
  });
});

// ── verifyPassword (PBKDF2) ────────────────────────────────────────────────

describe("verifyPassword (PBKDF2)", () => {
  it("returns true for correct password", async () => {
    const hash = await hashPassword("mypassword");
    expect(await verifyPassword("mypassword", hash)).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("mypassword");
    expect(await verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("returns false for empty password", async () => {
    const hash = await hashPassword("mypassword");
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("returns false for tampered hash", async () => {
    const hash = await hashPassword("mypassword");
    const tampered = hash.slice(0, -2) + "XX";
    expect(await verifyPassword("mypassword", tampered)).toBe(false);
  });
});

// ── verifyPassword (legacy SHA-256 backward compat) ────────────────────────

describe("verifyPassword (legacy SHA-256)", () => {
  it("verifies legacy SHA-256 hash with correct password", async () => {
    const salt = "test-salt-abc";
    const hash = await legacyHashSHA256("oldpassword", salt);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyPassword("oldpassword", hash, salt)).toBe(true);
  });

  it("rejects legacy hash with wrong password", async () => {
    const salt = "test-salt-def";
    const hash = await legacyHashSHA256("oldpassword", salt);
    expect(await verifyPassword("wrongpassword", hash, salt)).toBe(false);
  });

  it("returns false when legacy salt is missing", async () => {
    const hash = await legacyHashSHA256("password", "salt");
    expect(await verifyPassword("password", hash)).toBe(false);
    expect(await verifyPassword("password", hash, null)).toBe(false);
  });
});

// ── isLegacyHash ───────────────────────────────────────────────────────────

describe("isLegacyHash", () => {
  it("returns false for PBKDF2 hashes", async () => {
    const hash = await hashPassword("test");
    expect(isLegacyHash(hash)).toBe(false);
  });

  it("returns true for legacy SHA-256 hex hashes", async () => {
    const hash = await legacyHashSHA256("test", "salt");
    expect(isLegacyHash(hash)).toBe(true);
  });
});

// ── constantTimeEqual ──────────────────────────────────────────────────────

describe("constantTimeEqual", () => {
  it("returns true for identical arrays", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(true);
  });

  it("returns false for differing arrays", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it("returns false for different-length arrays", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });
});
