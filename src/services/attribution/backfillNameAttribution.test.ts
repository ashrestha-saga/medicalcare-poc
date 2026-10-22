import { describe, expect, it } from "vitest";
import {
  resolveUserIdForName,
  uniqueNameToUserId,
} from "@/services/attribution/backfillNameAttribution";

describe("uniqueNameToUserId", () => {
  const users = [
    { id: "u1", name: "Anna Technik", tenantId: "t1" },
    { id: "u2", name: "Clara Sicherheit", tenantId: "t1" },
    { id: "u3", name: "Anna Technik", tenantId: "t2" },
    { id: "u4", name: "  Dup Name  ", tenantId: "t1" },
    { id: "u5", name: "Dup Name", tenantId: "t1" },
  ];

  it("maps unique names within a tenant", () => {
    const map = uniqueNameToUserId(users, { tenantId: "t1" });
    expect(map.get("Anna Technik")).toBe("u1");
    expect(map.get("Clara Sicherheit")).toBe("u2");
    expect(map.has("Dup Name")).toBe(false);
  });

  it("leaves ambiguous global names unresolved", () => {
    const map = uniqueNameToUserId(users);
    expect(map.has("Anna Technik")).toBe(false);
    expect(map.get("Clara Sicherheit")).toBe("u2");
  });
});

describe("resolveUserIdForName", () => {
  it("trims and looks up", () => {
    const map = new Map([["Anna Technik", "u1"]]);
    expect(resolveUserIdForName("  Anna Technik ", map)).toBe("u1");
    expect(resolveUserIdForName("Unknown", map)).toBeNull();
  });
});
