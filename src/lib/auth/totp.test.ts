import { describe, expect, it } from "vitest";
import {
  consumeBackupCode,
  createTotpSecret,
  currentTotpCode,
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  hashBackupCodes,
  normalizeBackupCode,
  verifyTotpCode,
} from "@/lib/auth/totp";
import { decodeTotpChallenge, encodeTotpChallenge } from "@/lib/auth/totpChallenge";

describe("totp crypto", () => {
  it("encrypts and decrypts secrets", () => {
    const secret = createTotpSecret();
    const enc = encryptTotpSecret(secret, "test-key-material");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptTotpSecret(enc, "test-key-material")).toBe(secret);
  });

  it("verifies a current TOTP code", () => {
    const secret = createTotpSecret();
    const token = currentTotpCode(secret);
    expect(verifyTotpCode(secret, token)).toBe(true);
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("consumes a backup code once", () => {
    const codes = generateBackupCodes(3);
    const hashes = hashBackupCodes(codes);
    const remaining = consumeBackupCode(hashes, codes[1]);
    expect(remaining).not.toBeNull();
    expect(remaining).toHaveLength(2);
    expect(consumeBackupCode(JSON.stringify(remaining), codes[1])).toBeNull();
    expect(consumeBackupCode(JSON.stringify(remaining), normalizeBackupCode(codes[0]))).not.toBeNull();
  });
});

describe("totp challenge cookie payload", () => {
  it("round-trips a signed challenge", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = encodeTotpChallenge(
      {
        user: { id: "u1", tenantId: "t1" },
        challengeId: "c1",
        iat: now,
        exp: now + 300,
      },
      "challenge-secret",
    );
    const decoded = decodeTotpChallenge(token, "challenge-secret");
    expect(decoded?.challengeId).toBe("c1");
    expect(decoded?.user.id).toBe("u1");
  });
});
