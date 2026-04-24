import { runAgent, type AgentToolDef } from "@avia/agents-shared";
import { BuildArtifact, type DesignProposal } from "@avia/shared-types";
import { DEVELOPER_SYSTEM_PROMPT } from "./prompt.js";

export interface DeveloperAgentDeps {
  xppFindObject: AgentToolDef;
  xppReadObject: AgentToolDef;
  xppCreateObject: AgentToolDef;
  xppUpdateObject: AgentToolDef;
  xppCompile: AgentToolDef;
  xppSyncDb: AgentToolDef;
  xppDeploy: AgentToolDef;
  model?: string;
  maxTurns?: number;
}

export async function runDeveloperAgent(
  input: DesignProposal,
  deps: DeveloperAgentDeps,
): Promise<BuildArtifact> {
  return runAgent({
    systemPrompt: DEVELOPER_SYSTEM_PROMPT,
    tools: [
      deps.xppFindObject,
      deps.xppReadObject,
      deps.xppCreateObject,
      deps.xppUpdateObject,
      deps.xppCompile,
      deps.xppSyncDb,
      deps.xppDeploy,
    ],
    input,
    outputSchema: BuildArtifact,
    ...(deps.model !== undefined ? { model: deps.model } : {}),
    maxTurns: deps.maxTurns ?? 60,
  });
}
