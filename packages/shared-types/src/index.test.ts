import { describe, expect, it } from "vitest";
import { DesignProposal, TaskState, WorkItemIntent, XppObjectType } from "./index.js";

describe("shared-types", () => {
  it("accepts a minimal WorkItemIntent", () => {
    const parsed = WorkItemIntent.parse({
      workItemId: 42,
      goal: "Block non-compliant customers from placing sales orders.",
      acceptance: ["Given a customer without certification, sales order creation is blocked."],
      scope: "SalesTable form, CustTable extension.",
    });
    expect(parsed.risks).toEqual([]);
  });

  it("enumerates all supported X++ object types", () => {
    expect(XppObjectType.options).toContain("table");
    expect(XppObjectType.options).toContain("form");
    expect(XppObjectType.options).toContain("class");
  });

  it("round-trips a TaskState in 'designing'", () => {
    const now = new Date().toISOString();
    const state = TaskState.parse({
      id: "task_001",
      workItemId: 1,
      status: "designing",
      createdAt: now,
      updatedAt: now,
    });
    expect(state.devTestLoops).toBe(0);
    expect(state.history).toEqual([]);
  });

  it("requires at least one acceptance criterion on a DesignProposal", () => {
    const proposal = DesignProposal.parse({
      summary: "Add a ComplianceCertification table.",
      changes: [],
      acceptance: ["Table appears in AOT."],
    });
    expect(proposal.risks).toEqual([]);
  });
});
