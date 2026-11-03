import { describe, expect, it } from "vitest";
import {
  inspectFollowUpListWhere,
  inspectFollowUpStatus,
} from "./inspectFollowUpService";

describe("inspectFollowUpListWhere", () => {
  it("scopes to own proposals with a parent and excludes rejected", () => {
    const where = inspectFollowUpListWhere("user-a", "org-1");
    expect(where.raisedById).toBe("user-a");
    expect(where.executorOrg).toEqual({ organisationId: "org-1" });
    expect(where.parentRequestId).toEqual({ not: null });
    expect(where.state).toEqual({ not: "rejected" });
  });
});

describe("inspectFollowUpStatus", () => {
  it("is waiting when handed off with no assignee", () => {
    expect(
      inspectFollowUpStatus({
        state: "handed_off",
        assigneeUserId: null,
        scheduledAt: null,
      }),
    ).toBe("waiting");
  });

  it("is assigned when a handler is set but not scheduled", () => {
    expect(
      inspectFollowUpStatus({
        state: "acknowledged",
        assigneeUserId: "u1",
        scheduledAt: null,
      }),
    ).toBe("assigned");
  });

  it("is scheduled when an appointment exists", () => {
    expect(
      inspectFollowUpStatus({
        state: "acknowledged",
        assigneeUserId: "u1",
        scheduledAt: new Date("2026-11-04T10:00:00Z"),
      }),
    ).toBe("scheduled");
  });

  it("is in_progress / done from state", () => {
    expect(
      inspectFollowUpStatus({
        state: "in_progress",
        assigneeUserId: "u1",
        scheduledAt: new Date(),
      }),
    ).toBe("in_progress");
    expect(
      inspectFollowUpStatus({
        state: "completed",
        assigneeUserId: "u1",
        scheduledAt: new Date(),
      }),
    ).toBe("done");
  });
});
