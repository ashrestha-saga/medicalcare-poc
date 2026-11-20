/**
 * Lightweight API-shaped acceptance for import core (A25-ish) using service layer.
 * Full HTTP e2e needs seeded DB; this validates upload→preview→commit against praxis-1.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { seedImportDictionary } from "../../../../prisma/seeds/importDictionary";
import { importJobService } from "@/services/import/importJobService";
import type { ActingContext } from "@/interfaces/session";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { withTenantStore } from "@/lib/auth/tenantContext";

const FIX = join(process.cwd(), "fixtures/import");

const skip = process.env.VITEST_SKIP_DB === "1";

describe.skipIf(skip)("importJobService praxis-1 acceptance", () => {
  let ctx: ActingContext;

  beforeAll(async () => {
    await runWithoutTenantAsync(async () => {
      await seedImportDictionary(prisma);
      const tenant = await prisma.tenant.findFirst();
      const user = await prisma.user.findFirst({
        where: { role: "device_admin", accountKind: "clinic" },
      });
      if (!tenant || !user) throw new Error("Seed tenant/user required");
      ctx = {
        tenantId: tenant.id,
        correlationId: "import-test",
        permissions: ["inventory:view", "inventory:update", "import:manage"],
        user: {
          id: user.id,
          name: user.name,
          accountKind: "clinic",
          role: "device_admin",
          tenantId: tenant.id,
        },
        actor: {
          tenantId: tenant.id,
          actorUserId: user.id,
          actorKind: "clinic",
          actorRole: "device_admin",
          actorName: user.name,
          organisationId: null,
          organisationName: null,
          serviceContractId: null,
          correlationId: "import-test",
          ip: null,
          userAgent: null,
        },
      };
    });
  });

  it("A25-ish: praxis-1 preview green share ≥ 70% and commit drafts", async () => {
    await withTenantStore(ctx, async () => {
      const buf = readFileSync(join(FIX, "praxis-1-hausarzt-bestandsverzeichnis.xlsx"));
      const uploaded = await importJobService.upload(ctx, {
        fileName: "praxis-1-hausarzt-bestandsverzeichnis.xlsx",
        buffer: buf,
      });
      const preview = await importJobService.preview(ctx, uploaded.job.id);
      expect(preview.stats.deviceRows).toBe(28);
      expect(preview.stats.greenShare).toBeGreaterThanOrEqual(0.7);
      const mappedCols =
        (uploaded.job.mapping as { sheets: { columns: { field: string | null }[] }[] })
          ?.sheets[0]?.columns.filter((c) => c.field && c.field !== "ignorieren").length ?? 0;
      expect(mappedCols).toBeGreaterThanOrEqual(10);

      const committed = await importJobService.commit(ctx, uploaded.job.id);
      expect("neu" in committed ? committed.neu + committed.aktualisiert : 0).toBeGreaterThanOrEqual(
        20,
      );

      // A26: re-upload → mostly updates
      const again = await importJobService.upload(ctx, {
        fileName: "praxis-1-hausarzt-bestandsverzeichnis.xlsx",
        buffer: buf,
      });
      const preview2 = await importJobService.preview(ctx, again.job.id);
      expect(preview2.stats.new).toBe(0);
      expect(preview2.stats.updated).toBeGreaterThanOrEqual(20);
    });
  });
});
