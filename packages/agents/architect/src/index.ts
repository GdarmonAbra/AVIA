import { runAgent, type AgentToolDef } from "@avia/agents-shared";
import { DesignProposal, type WorkItemIntent } from "@avia/shared-types";
import { ARCHITECT_SYSTEM_PROMPT } from "./prompt.js";

export interface ArchitectAgentDeps {
  xppFindObject: AgentToolDef;
  xppReadObject: AgentToolDef;
  adoGetWorkItem: AgentToolDef;
  model?: string;
}

export async function runArchitectAgent(
  input: WorkItemIntent,
  deps: ArchitectAgentDeps,
): Promise<DesignProposal> {
  return runAgent({
    systemPrompt: ARCHITECT_SYSTEM_PROMPT,
    tools: [deps.xppFindObject, deps.xppReadObject, deps.adoGetWorkItem],
    input,
    outputSchema: DesignProposal,
    ...(deps.model !== undefined ? { model: deps.model } : {}),
  });
}
