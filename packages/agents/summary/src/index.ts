import { runAgent, type AgentToolDef } from "@avia/agents-shared";
import { WorkItemIntent } from "@avia/shared-types";
import { SUMMARY_SYSTEM_PROMPT } from "./prompt.js";

export interface SummaryAgentInput {
  workItemId: string | number;
}

export interface SummaryAgentDeps {
  /**
   * Tool defs the agent can call — typically every tool from the `azure-devops`
   * MCP server (`registry.tools("azure-devops")`).
   */
  tools: AgentToolDef[];
  model?: string;
}

export async function runSummaryAgent(
  input: SummaryAgentInput,
  deps: SummaryAgentDeps,
): Promise<WorkItemIntent> {
  return runAgent<WorkItemIntent>({
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    tools: deps.tools,
    input,
    outputSchema: WorkItemIntent,
    ...(deps.model !== undefined ? { model: deps.model } : {}),
  });
}

export { SUMMARY_SYSTEM_PROMPT } from "./prompt.js";
