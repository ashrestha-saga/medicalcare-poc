import { describe, expect, it } from "vitest";
import { consoleNavPresetFor, CONSOLE_NAV_PRESETS } from "./partnerConsoleNav";
import { KNOWN_PARTNER_APP_ROLES } from "./partnerPermissions";

describe("CONSOLE_NAV_PRESETS Phase 1 — Meine Einrichtungen for all roles", () => {
  it("includes meine for every known partner app role", () => {
    for (const role of KNOWN_PARTNER_APP_ROLES) {
      const preset = consoleNavPresetFor(role);
      const all = [...preset.taeglich, ...preset.regel, ...preset.selten];
      expect(all, `role ${role} missing meine`).toContain("meine");
    }
  });

  it("keeps meine in Technik Täglich and others in Regelmäßig", () => {
    expect(CONSOLE_NAV_PRESETS.inspector.taeglich).toContain("meine");
    expect(CONSOLE_NAV_PRESETS.admin.regel).toContain("meine");
    expect(CONSOLE_NAV_PRESETS.management.regel).toContain("meine");
    expect(CONSOLE_NAV_PRESETS.service_lead.regel).toContain("meine");
    expect(CONSOLE_NAV_PRESETS.order.regel).toContain("meine");
  });
});
