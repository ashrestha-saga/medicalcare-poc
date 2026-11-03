import { describe, expect, it } from "vitest";
import { tagesBucket } from "./dayBuckets";

describe("tagesBucket", () => {
  const today = new Date("2026-10-30T12:00:00.000Z");

  it("buckets due dates", () => {
    expect(tagesBucket(null, today)).toBe("ohne");
    expect(tagesBucket("2026-10-30", today)).toBe("heute");
    expect(tagesBucket("2026-10-29", today)).toBe("heute");
    expect(tagesBucket("2026-10-31", today)).toBe("morgen");
    expect(tagesBucket("2026-11-03", today)).toBe("woche");
    expect(tagesBucket("2026-12-01", today)).toBe("spaeter");
  });
});
