import { z } from "zod";

export const XppObjectType = z.enum([
  "table",
  "form",
  "class",
  "enum",
  "view",
  "query",
  "menuItem",
  "edt",
  "map",
]);
export type XppObjectType = z.infer<typeof XppObjectType>;

export const XppObject = z.object({
  type: XppObjectType,
  name: z.string(),
  model: z.string(),
  path: z.string().optional(),
  properties: z.record(z.unknown()).default({}),
  source: z.string().optional(),
});
export type XppObject = z.infer<typeof XppObject>;

export const CompileDiagnostic = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  severity: z.enum(["error", "warning", "info"]),
  code: z.string(),
  message: z.string(),
});
export type CompileDiagnostic = z.infer<typeof CompileDiagnostic>;

// ─── Agent I/O ────────────────────────────────────────────────────────────────

export const WorkItemIntent = z.object({
  workItemId: z.union([z.string(), z.number()]),
  goal: z.string(),
  acceptance: z.array(z.string()).min(1),
  scope: z.string(),
  risks: z.array(z.string()).default([]),
  ambiguities: z.array(z.string()).default([]),
});
export type WorkItemIntent = z.infer<typeof WorkItemIntent>;

export const DesignChange = z.object({
  objectType: XppObjectType,
  objectName: z.string(),
  model: z.string(),
  operation: z.enum(["create", "extend", "modify", "delete"]),
  rationale: z.string(),
});
export type DesignChange = z.infer<typeof DesignChange>;

export const DesignProposal = z.object({
  summary: z.string(),
  changes: z.array(DesignChange),
  acceptance: z.array(z.string()),
  risks: z.array(z.string()).default([]),
});
export type DesignProposal = z.infer<typeof DesignProposal>;

export const BuildArtifact = z.object({
  model: z.string(),
  env: z.enum(["uat", "sandbox", "dev"]),
  compileLog: z.string(),
  deploymentId: z.string(),
  deployedAt: z.string(), // ISO-8601
});
export type BuildArtifact = z.infer<typeof BuildArtifact>;

export const TestResult = z.object({
  criterion: z.string(),
  pass: z.boolean(),
  evidence: z.string(), // tool calls + responses that prove it
  failureReason: z.string().optional(),
});
export type TestResult = z.infer<typeof TestResult>;

export const TestReport = z.object({
  pass: z.boolean(),
  results: z.array(TestResult),
  startedAt: z.string(),
  finishedAt: z.string(),
});
export type TestReport = z.infer<typeof TestReport>;

// ─── Orchestrator task state ──────────────────────────────────────────────────

export const TaskStatus = z.enum([
  "created",
  "summarizing",
  "summarized",
  "designing",
  "awaiting_user_approval",
  "approved",
  "rejected",
  "developing",
  "built",
  "testing",
  "passed",
  "failed",
  "done",
  "aborted",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskState = z.object({
  id: z.string(),
  workItemId: z.union([z.string(), z.number()]),
  status: TaskStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
  intent: WorkItemIntent.optional(),
  proposal: DesignProposal.optional(),
  artifact: BuildArtifact.optional(),
  testReport: TestReport.optional(),
  devTestLoops: z.number().int().nonnegative().default(0),
  history: z
    .array(
      z.object({
        at: z.string(),
        from: TaskStatus,
        to: TaskStatus,
        note: z.string().optional(),
      }),
    )
    .default([]),
});
export type TaskState = z.infer<typeof TaskState>;

// ─── MCP error envelope ───────────────────────────────────────────────────────

export const McpError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type McpError = z.infer<typeof McpError>;
