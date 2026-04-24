import { runAgent, type AgentToolDef } from "@avia/agents-shared";
import { BuildArtifact, type DesignProposal } from "@avia/shared-types";
import { DEVELOPER_SYSTEM_PROMPT } from "./prompt.js";

export interface DeveloperAgentDeps {
  /**
   * Typically `registry.toolsFor("d365fo-nav", "fo-semantic")` — d365fo-nav is
   * the single X++ surface (read + limited write).
   */
  tools: AgentToolDef[];
  model?: string;
  maxTurns?: number;
}

export async function runDeveloperAgent(
  input: DesignProposal,
  deps: DeveloperAgentDeps,
): Promise<BuildArtifact> {
  return runAgent<BuildArtifact>({
    systemPrompt: DEVELOPER_SYSTEM_PROMPT,
    tools: deps.tools,
    input,
    outputSchema: BuildArtifact,
    ...(deps.model !== undefined ? { model: deps.model } : {}),
    maxTurns: deps.maxTurns ?? 60,
  });
}

export { DEVELOPER_SYSTEM_PROMPT } from "./prompt.js";
