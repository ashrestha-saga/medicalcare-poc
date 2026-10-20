import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TENANT_GUARD_EXCLUSIONS, TENANT_SCOPED_MODELS } from "./tenantExtension";

/** Parse prisma/schema.prisma for models that declare a non-optional tenantId. */
function requiredTenantIdModels(schema: string): Set<string> {
  const models = schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm);
  const required = new Set<string>();
  for (const m of models) {
    const name = m[1];
    const body = m[2];
    if (/tenantId\s+String\s*\?/.test(body)) continue;
    if (/tenantId\s+String/.test(body)) required.add(name);
  }
  return required;
}

describe("SEC-01 tenant guard drift", () => {
  it("guards every Prisma model with a required tenantId (or lists it as exclusion)", () => {
    const schemaPath = join(process.cwd(), "prisma/schema.prisma");
    const schema = readFileSync(schemaPath, "utf8");
    const required = requiredTenantIdModels(schema);

    const missing = [...required].filter(
      (name) => !TENANT_SCOPED_MODELS.has(name) && !TENANT_GUARD_EXCLUSIONS.has(name),
    );
    const staleExclusions = [...TENANT_GUARD_EXCLUSIONS].filter((name) => !required.has(name));
    const staleGuards = [...TENANT_SCOPED_MODELS].filter((name) => !required.has(name));

    expect(missing, `Add to TENANT_SCOPED_MODELS or TENANT_GUARD_EXCLUSIONS: ${missing.join(", ")}`).toEqual(
      [],
    );
    expect(
      staleExclusions,
      `Remove stale TENANT_GUARD_EXCLUSIONS: ${staleExclusions.join(", ")}`,
    ).toEqual([]);
    // UserInvitation is optional tenantId but still guarded for clinic-invite paths.
    expect(
      staleGuards.filter((n) => n !== "UserInvitation"),
      `Remove stale TENANT_SCOPED_MODELS entries: ${staleGuards.join(", ")}`,
    ).toEqual([]);
  });
});
