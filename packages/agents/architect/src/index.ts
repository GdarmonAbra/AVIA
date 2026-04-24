import { runAgent, type AgentToolDef } from "@avia/agents-shared";
import { DesignProposal, type WorkItemIntent } from "@avia/shared-types";
import { ARCHITECT_SYSTEM_PROMPT } from "./prompt.js";

export interface ArchitectAgentDeps {
  /**
   * Typically `registry.toolsFor("d365fo-nav", "fo-semantic", "azure-devops")`.
   */
  tools: AgentToolDef[];
  model?: string;
}

export async function runArchitectAgent(
  input: WorkItemIntent,
  deps: ArchitectAgentDeps,
): Promise<DesignProposal> {
  return runAgent<DesignProposal>({
    systemPrompt: ARCHITECT_SYSTEM_PROMPT,
    tools: deps.tools,
    input,
    outputSchema: DesignProposal,
    ...(deps.model !== undefined ? { model: deps.model } : {}),
  });
}

export { ARCHITECT_SYSTEM_PROMPT } from "./prompt.js";
