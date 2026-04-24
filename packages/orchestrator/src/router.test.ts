import { describe, expect, it } from "vitest";
import type { BuildArtifact, DesignProposal, TaskState, TestReport, WorkItemIntent } from "@avia/shared-types";
import { reduce, type Event } from "./router.js";

const NOW = "2026-04-24T00:00:00.000Z";

function baseState(overrides: Partial<TaskState> = {}): TaskState {
  return {
    id: "task_1",
    workItemId: 42,
    status: "created",
    createdAt: NOW,
    updatedAt: NOW,
    devTestLoops: 0,
    history: [],
    ...overrides,
  };
}

const INTENT: WorkItemIntent = {
  workItemId: 42,
  goal: "g",
  acceptance: ["a"],
  scope: "s",
  risks: [],
  ambiguities: [],
};

const PROPOSAL: DesignProposal = {
  summary: "s",
  changes: [],
  acceptance: ["a"],
  risks: [],
};

const ARTIFACT: BuildArtifact = {
  model: "m",
  env: "dev",
  compileLog: "",
  deploymentId: "d",
  deployedAt: NOW,
};

const FAIL_REPORT: TestReport = {
  pass: false,
  results: [{ criterion: "a", pass: false, evidence: "" }],
  startedAt: NOW,
  finishedAt: NOW,
};

const PASS_REPORT: TestReport = {
  pass: true,
  results: [{ criterion: "a", pass: true, evidence: "ok" }],
  startedAt: NOW,
  finishedAt: NOW,
};

describe("orchestrator.reduce", () => {
  it("walks the happy path created → done", () => {
    const events: Event[] = [
      { type: "START", at: NOW },
      { type: "SUMMARY_COMPLETED", at: NOW, intent: INTENT },
      { type: "DESIGN_COMPLETED", at: NOW, proposal: PROPOSAL },
      { type: "USER_APPROVED", at: NOW },
      { type: "DEV_COMPLETED", at: NOW, artifact: ARTIFACT },
      { type: "TEST_COMPLETED", at: NOW, report: PASS_REPORT },
    ];
    const final = events.reduce(reduce, baseState());
    expect(final.status).toBe("done");
    expect(final.intent).toEqual(INTENT);
    expect(final.artifact).toEqual(ARTIFACT);
    expect(final.history).toHaveLength(events.length);
  });

  it("rejects out-of-order events (ignores, does not crash)", () => {
    const s = reduce(baseState(), {
      type: "DESIGN_COMPLETED",
      at: NOW,
      proposal: PROPOSAL,
    });
    expect(s.status).toBe("created");
  });

  it("loops dev↔test on failing tests up to the bound", () => {
    let s: TaskState = baseState({ status: "testing", devTestLoops: 0 });
    s = reduce(s, { type: "TEST_COMPLETED", at: NOW, report: FAIL_REPORT });
    expect(s.status).toBe("developing");
    expect(s.devTestLoops).toBe(1);

    s = reduce({ ...s, status: "testing" }, {
      type: "TEST_COMPLETED",
      at: NOW,
      report: FAIL_REPORT,
    });
    expect(s.status).toBe("developing");
    expect(s.devTestLoops).toBe(2);

    s = reduce({ ...s, status: "testing" }, {
      type: "TEST_COMPLETED",
      at: NOW,
      report: FAIL_REPORT,
    });
    expect(s.status).toBe("failed");
    expect(s.devTestLoops).toBe(3);
  });

  it("honors USER_REJECTED from awaiting_user_approval", () => {
    const s = reduce(baseState({ status: "awaiting_user_approval" }), {
      type: "USER_REJECTED",
      at: NOW,
      reason: "scope too large",
    });
    expect(s.status).toBe("rejected");
    expect(s.history.at(-1)?.note).toBe("scope too large");
  });
});
