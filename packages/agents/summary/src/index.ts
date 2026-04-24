import { runAgent, type AgentToolDef } from "@avia/agents-shared";
import { WorkItemIntent } from "@avia/shared-types";
import { SUMMARY_SYSTEM_PROMPT } from "./prompt.js";

export interface SummaryAgentInput {
  workItemId: string | number;
}

export interface SummaryAgentDeps {
  adoGetWorkItem: AgentToolDef;
  model?: string;
}

export async function runSummaryAgent(
  input: SummaryAgentInput,
  deps: SummaryAgentDeps,
): Promise<WorkItemIntent> {
  return runAgent({
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    tools: [deps.adoGetWorkItem],
    input,
    outputSchema: WorkItemIntent,
    ...(deps.model !== undefined ? { model: deps.model } : {}),
  });
}
