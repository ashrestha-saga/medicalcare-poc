import { afterAll, describe, expect, it, vi } from "vitest";
import { parseIdentifier } from "@/lib/gs1";
import { prisma } from "@/lib/prisma";
import { RateLimiter, HOUR_MS, DAY_MS } from "@/lib/rateLimit";
import { createBeudamedService } from "@/services/beudamed/beudamedService";
import { beudamedMockLookup } from "@/services/adapters/beudamedAdapters";
import { createResolveService, resolveService } from "@/services/resolve/resolveService";

const TENANT = "demo-tenant";
const cid = "test-correlation-id";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("resolution chain — FA-100 (AC #1, #2, #9)", () => {
  it("stage 1: inventory number → device instance with location and verified proposal", async () => {
    const r = await resolveService.resolve(parseIdentifier("INV-10001"), TENANT, cid);
    expect(r.stage).toBe("inventory");
    expect(r.device?.inventoryNumber).toBe("INV-10001");
    expect(r.device?.location?.text).toBe("Bonn Clinic, ICU, Room 4");
    expect(r.model?.modelName).toBe("X200");
    expect(r.classificationProposal?.confidence).toBe("verified");
    expect(r.source.system).toBe("device-inventory");
    expect(r.correlationId).toBe(cid);
  });

  it("stage 1: serial number and GTIN+serial both find the same instance", async () => {
    const bySerial = await resolveService.resolve(parseIdentifier("SN-10001"), TENANT, cid);
    const byUdi = await resolveService.resolve(parseIdentifier("(01)04012345678901(21)SN10001"), TENANT, cid);
    expect(bySerial.device?.id).toBe("instance-inv-10001");
    expect(byUdi.device?.id).toBe("instance-inv-10001");
    expect(byUdi.identifier.kind).toBe("udi-di");
  });

  it("stage 1 is tenant-scoped (NFA-804)", async () => {
    const r = await resolveService.resolve(parseIdentifier("INV-10001"), "other-tenant", cid);
    expect(r.stage).not.toBe("inventory");
    expect(r.device).toBeUndefined();
  });

  it("stage 2: GTIN with no instance → local article master, derived proposal, no DeviceInstance created (FA-102)", async () => {
    const before = await prisma.deviceInstance.count();
    const r = await resolveService.resolve(parseIdentifier("04012345678925"), TENANT, cid);
    expect(r.stage).toBe("catalog");
    expect(r.model?.modelName).toBe("V3");
    expect(r.device).toBeUndefined();
    expect(r.classificationProposal).toBeUndefined(); // no rule for V3
    expect(await prisma.deviceInstance.count()).toBe(before);

    const derived = await resolveService.resolve(parseIdentifier("04012345678918"), TENANT, cid);
    expect(derived.classificationProposal?.confidence).toBe("derived");
  });

  it("stage 2: OXID (mock) catalog adapter answers for a GTIN unknown locally", async () => {
    const r = await resolveService.resolve(parseIdentifier("04012345678932"), TENANT, cid);
    expect(r.stage).toBe("catalog");
    expect(r.source.system).toBe("oxid-catalog");
    expect(r.model?.tradeName).toBe("Defibrillator D5");
  });

  it("stage 4: unknown identifier → capture, calmly", async () => {
    const r = await resolveService.resolve(parseIdentifier("TOTALLY-UNKNOWN-42"), TENANT, cid);
    expect(r.stage).toBe("capture");
    expect(r.source.system).toBe("none");
  });

  it("stage 3 failure falls through to capture without throwing (SS-201)", async () => {
    const svc = createResolveService({
      beudamed: {
        resolve: async () => {
          throw new Error("BEUDAMED HTTP 503");
        },
      },
    });
    const r = await svc.resolve(parseIdentifier("04012345678949"), TENANT, cid);
    expect(r.stage).toBe("capture");
  });
});

describe("BEUDAMED service — SS-201 cache, timeout, rate limit (AC #3, #10)", () => {
  const udi = "04012345678949";

  it("mock lookup persists a versioned DeviceModel + ExternalSourceRecord, second call is a cache hit", async () => {
    await prisma.externalSourceRecord.deleteMany({ where: { identifier: udi } });
    const lookup = { lookup: vi.fn(beudamedMockLookup.lookup) };
    const svc = createBeudamedService({ lookup, perIdentifier: new RateLimiter(10, HOUR_MS), perTenant: new RateLimiter(100, DAY_MS) });

    const first = await svc.resolve(parseIdentifier(udi), TENANT, cid);
    expect(first?.cached).toBe(false);
    expect(first?.model.source).toBe("beudamed");
    expect(first?.model.tradeName).toBe("Ultrasound U7");

    const second = await svc.resolve(parseIdentifier(udi), TENANT, cid);
    expect(second?.cached).toBe(true);
    expect(lookup.lookup).toHaveBeenCalledTimes(1);

    const logs = await prisma.externalCallLog.findMany({ where: { system: "beudamed", correlationId: cid }, orderBy: { startedAt: "asc" } });
    expect(logs.some((l) => l.cacheHit)).toBe(true);
    expect(logs.every((l) => l.identifierHash.length === 32)).toBe(true);
  });

  it("rate limit → miss (null), never an error", async () => {
    await prisma.externalSourceRecord.deleteMany({ where: { identifier: "04012345678901" } });
    const perIdentifier = new RateLimiter(1, HOUR_MS);
    perIdentifier.tryAcquire("04012345678901");
    const svc = createBeudamedService({ lookup: beudamedMockLookup, perIdentifier, perTenant: new RateLimiter(100, DAY_MS) });
    expect(await svc.resolve(parseIdentifier("04012345678901"), TENANT, cid)).toBeNull();
  });

  it("timeout aborts via AbortController and throws for resolveService to swallow", async () => {
    const slow = {
      lookup: (_: string, signal: AbortSignal) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    };
    const svc = createBeudamedService({ lookup: slow, perIdentifier: new RateLimiter(10, HOUR_MS), perTenant: new RateLimiter(100, DAY_MS) });
    await expect(svc.resolve(parseIdentifier("04012345678925"), TENANT, cid)).rejects.toThrow();
    const log = await prisma.externalCallLog.findFirst({ where: { system: "beudamed", error: { startsWith: "timeout" } } });
    expect(log).not.toBeNull();
  });

  it("stub adapter (no key configured) leaves the app fully usable", async () => {
    // Default mode in tests is "stub": stage 3 never calls out. An identifier nobody knows → capture.
    const unknown = await resolveService.resolve(parseIdentifier("04012345678956"), TENANT, "stub-run");
    expect(unknown.stage).toBe("capture");
    // The model persisted by the earlier mock run is now part of the device master (FA-103),
    // so the local catalog answers before stage 3 is even consulted.
    const persisted = await resolveService.resolve(parseIdentifier("04012345678949"), TENANT, "stub-run");
    expect(persisted.stage).toBe("catalog");
    expect(persisted.model?.source).toBe("beudamed");
  });
});
