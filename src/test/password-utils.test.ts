import { describe, it, expect } from "vitest";
import { generateSalt, hashPassword, verifyPassword } from "@/lib/password-utils";

describe("generateSalt", () => {
  it("returns a non-empty string", () => {
    const salt = generateSalt();
    expect(typeof salt).toBe("string");
    expect(salt.length).toBeGreaterThan(0);
  });

  it("returns unique values on each call", () => {
    const salts = Array.from({ length: 10 }, () => generateSalt());
    const unique = new Set(salts);
    expect(unique.size).toBe(10);
  });
});

describe("hashPassword", () => {
  it("returns a 64-char hex string (SHA-256)", async () => {
    const hash = await hashPassword("secret", "salt-abc");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same inputs produce same hash", async () => {
    const h1 = await hashPassword("password123", "fixed-salt");
    const h2 = await hashPassword("password123", "fixed-salt");
    expect(h1).toBe(h2);
  });

  it("different passwords produce different hashes", async () => {
    const h1 = await hashPassword("password1", "same-salt");
    const h2 = await hashPassword("password2", "same-salt");
    expect(h1).not.toBe(h2);
  });

  it("same password with different salts produce different hashes (rainbow table resistance)", async () => {
    const h1 = await hashPassword("samepassword", "salt-1");
    const h2 = await hashPassword("samepassword", "salt-2");
    expect(h1).not.toBe(h2);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("mypassword", salt);
    const result = await verifyPassword("mypassword", salt, hash);
    expect(result).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("mypassword", salt);
    const result = await verifyPassword("wrongpassword", salt, hash);
    expect(result).toBe(false);
  });

  it("returns false when hash is tampered", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("mypassword", salt);
    const tampered = hash.replace(hash[0], hash[0] === "a" ? "b" : "a");
    const result = await verifyPassword("mypassword", salt, tampered);
    expect(result).toBe(false);
  });

  it("returns false for empty password against non-empty hash", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("mypassword", salt);
    const result = await verifyPassword("", salt, hash);
    expect(result).toBe(false);
  });
});
