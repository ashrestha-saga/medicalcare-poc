/**
 * DEMO_SHARED_TOTP
 */
import { afterEach, describe, expect, it, vi } from "vitest";

describe("DEMO_SHARED_TOTP sharedTotp helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is inactive in test even when enabled", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DEMO_SHARED_TOTP_ENABLED", "true");
    vi.stubEnv("DEMO_SHARED_TOTP_SECRET", "JBSWY3DPEHPK3PXP");
    const { isDemoSharedTotpActive } = await import("./sharedTotp");
    expect(isDemoSharedTotpActive()).toBe(false);
  });

  it("is active in production when explicitly enabled with a secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_SHARED_TOTP_ENABLED", "true");
    vi.stubEnv("DEMO_SHARED_TOTP_SECRET", "JBSWY3DPEHPK3PXP");
    const mod = await import("./sharedTotp");
    expect(mod.isDemoSharedTotpActive()).toBe(true);
    expect(mod.clinicLoginRequires2fa({ totpEnabled: false, totpSecretEnc: null })).toBe(true);
  });

  it("is active in development when enabled with a secret", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_SHARED_TOTP_ENABLED", "true");
    vi.stubEnv("DEMO_SHARED_TOTP_SECRET", "JBSWY3DPEHPK3PXP");
    const mod = await import("./sharedTotp");
    expect(mod.isDemoSharedTotpActive()).toBe(true);
    expect(mod.clinicUserUsesPersonalTotp({ totpEnabled: true, totpSecretEnc: "enc" })).toBe(true);
  });

  it("stays off when enabled flag is missing or secret empty", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_SHARED_TOTP_ENABLED", "true");
    vi.stubEnv("DEMO_SHARED_TOTP_SECRET", "");
    let mod = await import("./sharedTotp");
    expect(mod.isDemoSharedTotpActive()).toBe(false);

    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_SHARED_TOTP_ENABLED", "false");
    vi.stubEnv("DEMO_SHARED_TOTP_SECRET", "JBSWY3DPEHPK3PXP");
    mod = await import("./sharedTotp");
    expect(mod.isDemoSharedTotpActive()).toBe(false);
  });

  it("bridge pass: open when unset, strict when set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_SHARED_TOTP_ENABLED", "true");
    vi.stubEnv("DEMO_SHARED_TOTP_SECRET", "JBSWY3DPEHPK3PXP");
    vi.stubEnv("DEMO_BRIDGE_PASS", "");
    let mod = await import("./sharedTotp");
    expect(mod.demoBridgePassOk(null)).toBe(true);

    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_SHARED_TOTP_ENABLED", "true");
    vi.stubEnv("DEMO_SHARED_TOTP_SECRET", "JBSWY3DPEHPK3PXP");
    vi.stubEnv("DEMO_BRIDGE_PASS", "secret-pass");
    mod = await import("./sharedTotp");
    expect(mod.demoBridgePassOk(null)).toBe(false);
    expect(mod.demoBridgePassOk("wrong")).toBe(false);
    expect(mod.demoBridgePassOk("secret-pass")).toBe(true);
  });
});
