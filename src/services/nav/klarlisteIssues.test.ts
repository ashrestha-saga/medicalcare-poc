import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/clarifications/clarificationService", () => ({
  clarificationService: {
    countOpenCases: vi.fn(async () => 7),
  },
}));

import { clarificationService } from "@/services/clarifications/clarificationService";
import { countKlarlisteDevices } from "./klarlisteIssues";

describe("countKlarlisteDevices", () => {
  it("delegates to clarification open-case count (E11 = open issues)", async () => {
    const n = await countKlarlisteDevices({ tenantId: "t1" } as never);
    expect(n).toBe(7);
    expect(clarificationService.countOpenCases).toHaveBeenCalledOnce();
  });
});
