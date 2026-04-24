import { runAgent, type AgentToolDef } from "@avia/agents-shared";
import { TestReport, type BuildArtifact } from "@avia/shared-types";
import { TESTER_SYSTEM_PROMPT } from "./prompt.js";

export interface TesterAgentInput {
  artifact: BuildArtifact;
  acceptance: string[];
  taskId: string;
}

export interface TesterAgentDeps {
  /**
   * Typically `registry.toolsFor("erp", "d365fo-nav")`.
   * Microsoft recommends Claude Sonnet 4.5 for the ERP MCP; AVIA uses
   * `claude-sonnet-4-6` by default as the equivalent current-gen model.
   */
  tools: AgentToolDef[];
  model?: string;
  maxTurns?: number;
}

export async function runTesterAgent(
  input: TesterAgentInput,
  deps: TesterAgentDeps,
): Promise<TestReport> {
  return runAgent<TestReport>({
    systemPrompt: TESTER_SYSTEM_PROMPT,
    tools: deps.tools,
    input,
    outputSchema: TestReport,
    ...(deps.model !== undefined ? { model: deps.model } : {}),
    maxTurns: deps.maxTurns ?? 40,
  });
}

export { TESTER_SYSTEM_PROMPT } from "./prompt.js";
