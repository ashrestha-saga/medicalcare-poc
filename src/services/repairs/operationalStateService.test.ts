import { describe, expect, it } from "vitest";
import type { OperationalState } from "@prisma/client";
import {
  canTransitionOperationalState,
  OPERATIONAL_STATE_TRANSITIONS,
} from "./operationalStateService";

const ALL: OperationalState[] = [
  "in_service",
  "locked",
  "under_repair",
  "replaced",
  "loaner",
];

describe("OPERATIONAL_STATE_TRANSITIONS", () => {
  it("allows identity (no-op) transitions", () => {
    for (const s of ALL) {
      expect(canTransitionOperationalState(s, s)).toBe(true);
    }
  });

  it("allows the documented edges", () => {
    expect(canTransitionOperationalState("in_service", "locked")).toBe(true);
    expect(canTransitionOperationalState("in_service", "under_repair")).toBe(true);
    expect(canTransitionOperationalState("in_service", "loaner")).toBe(true);
    expect(canTransitionOperationalState("locked", "in_service")).toBe(true);
    expect(canTransitionOperationalState("locked", "under_repair")).toBe(true);
    expect(canTransitionOperationalState("under_repair", "in_service")).toBe(true);
    expect(canTransitionOperationalState("under_repair", "locked")).toBe(true);
    expect(canTransitionOperationalState("replaced", "in_service")).toBe(true);
    expect(canTransitionOperationalState("loaner", "in_service")).toBe(true);
  });

  it("refuses invalid edges", () => {
    expect(canTransitionOperationalState("loaner", "locked")).toBe(false);
    expect(canTransitionOperationalState("loaner", "under_repair")).toBe(false);
    expect(canTransitionOperationalState("in_service", "in_service" as OperationalState)).toBe(true);
    expect(canTransitionOperationalState("replaced", "loaner")).toBe(false);
    expect(canTransitionOperationalState("locked", "loaner")).toBe(false);
  });

  it("table covers every OperationalState key", () => {
    expect(Object.keys(OPERATIONAL_STATE_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });
});
