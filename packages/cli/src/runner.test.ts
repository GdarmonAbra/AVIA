import { describe, expect, it, vi } from "vitest";

import type { McpRegistry } from "@avia/agents-shared";
import type { TaskStore } from "@avia/orchestrator";
import type {
  BuildArtifact,
  DesignProposal,
  TaskState,
  TestReport,
  WorkItemIntent,
} from "@avia/shared-types";

import { run } from "./runner.js";

function stubRegistry(): McpRegistry {
  return {
    tools: vi.fn(async () => []),
    toolsFor: vi.fn(async () => []),
    closeAll: vi.fn(async () => {}),
  } as unknown as McpRegistry;
}

function memoryStore(): TaskStore & { snapshot(): TaskState | null } {
  let saved: TaskState | null = null;
  return {
    async load() {
      return saved;
    },
    async save(state) {
      saved = JSON.parse(JSON.stringify(state));
    },
    async list() {
      return saved ? [saved.id] : [];
    },
    snapshot() {
      return saved;
    },
  };
}

const intent: WorkItemIntent = {
  workItemId: 42,
  goal: "Block non-compliant customers from sales orders.",
  acceptance: ["Given a customer without certification, sales order is blocked."],
  scope: "SalesTable, CustTable",
  risks: [],
  ambiguities: [],
};

const proposal: DesignProposal = {
  summary: "Add compliance table + SalesTable validation.",
  changes: [
    {
      objectType: "table",
      objectName: "ComplianceCertification",
      model: "AviaFleet",
      operation: "create",
      rationale: "Track cert state.",
    },
  ],
  acceptance: intent.acceptance,
  risks: [],
};

const artifact: BuildArtifact = {
  model: "AviaFleet",
  env: "dev",
  solutionPath: "C:\\AosService\\PackagesLocalDirectory\\AviaFleet\\VSProjects\\AviaFleet.sln",
  projects: [
    {
      name: "AviaFleet",
      model: "AviaFleet",
      rnrprojPath:
        "C:\\AosService\\PackagesLocalDirectory\\AviaFleet\\VSProjects\\AviaFleet\\AviaFleet.rnrproj",
    },
  ],
  configuration: "Debug",
  compileLog: "Build succeeded.",
  deploymentId: "deploy-001",
  deployedAt: "2026-04-24T10:00:00.000Z",
};

const passingReport: TestReport = {
  pass: true,
  results: intent.acceptance.map((c) => ({
    criterion: c,
    pass: true,
    evidence: "erp.createCustomer + erp.createSalesOrder returned expected failure.",
  })),
  startedAt: "2026-04-24T10:01:00.000Z",
  finishedAt: "2026-04-24T10:02:00.000Z",
};

describe("runner", () => {
  it("drives created → done through every stage with auto-approve", async () => {
    const store = memoryStore();
    const summary = vi.fn(async () => intent);
    const architect = vi.fn(async () => proposal);
    const developer = vi.fn(async () => artifact);
    const tester = vi.fn(async () => passingReport);

    const result = await run(
      { workItemId: 42, autoApprove: true },
      {
        registry: stubRegistry(),
        store,
        approver: async () => true,
        logger: () => {},
        agents: { summary, architect, developer, tester },
        now: () => "2026-04-24T10:00:00.000Z",
      },
    );

    expect(result.final.status).toBe("done");
    expect(result.stoppedEarly).toBe(false);
    expect(summary).toHaveBeenCalledTimes(1);
    expect(architect).toHaveBeenCalledTimes(1);
    expect(developer).toHaveBeenCalledTimes(1);
    expect(tester).toHaveBeenCalledTimes(1);
    expect(store.snapshot()?.artifact?.solutionPath).toContain(".sln");
  });

  it("stops after design when stopAfter=design", async () => {
    const result = await run(
      { workItemId: 42, stopAfter: "design", autoApprove: true },
      {
        registry: stubRegistry(),
        store: memoryStore(),
        approver: async () => true,
        logger: () => {},
        agents: {
          summary: async () => intent,
          architect: async () => proposal,
          developer: async () => {
            throw new Error("should not be called");
          },
          tester: async () => {
            throw new Error("should not be called");
          },
        },
        now: () => "2026-04-24T10:00:00.000Z",
      },
    );

    expect(result.stoppedEarly).toBe(true);
    expect(result.final.status).toBe("awaiting_user_approval");
    expect(result.final.proposal?.summary).toBe(proposal.summary);
  });

  it("routes to rejected when the approver declines", async () => {
    const result = await run(
      { workItemId: 42 },
      {
        registry: stubRegistry(),
        store: memoryStore(),
        approver: async () => false,
        logger: () => {},
        agents: {
          summary: async () => intent,
          architect: async () => proposal,
          developer: async () => {
            throw new Error("should not reach developer");
          },
          tester: async () => {
            throw new Error("should not reach tester");
          },
        },
        now: () => "2026-04-24T10:00:00.000Z",
      },
    );

    expect(result.final.status).toBe("rejected");
  });

  it("aborts on agent failure and records reason in history", async () => {
    const result = await run(
      { workItemId: 42, autoApprove: true },
      {
        registry: stubRegistry(),
        store: memoryStore(),
        approver: async () => true,
        logger: () => {},
        agents: {
          summary: async () => {
            throw new Error("azure-devops unreachable");
          },
          architect: async () => proposal,
          developer: async () => artifact,
          tester: async () => passingReport,
        },
        now: () => "2026-04-24T10:00:00.000Z",
      },
    );

    expect(result.final.status).toBe("aborted");
    expect(result.final.history.at(-1)?.note).toContain("azure-devops unreachable");
  });
});
