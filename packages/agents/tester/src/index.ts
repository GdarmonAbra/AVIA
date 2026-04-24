import { runAgent, type AgentToolDef } from "@avia/agents-shared";
import { TestReport, type BuildArtifact } from "@avia/shared-types";
import { TESTER_SYSTEM_PROMPT } from "./prompt.js";

export interface TesterAgentInput {
  artifact: BuildArtifact;
  acceptance: string[];
  taskId: string;
}

export interface TesterAgentDeps {
  d365Query: AgentToolDef;
  d365Create: AgentToolDef;
  d365Update: AgentToolDef;
  d365InvokeAction: AgentToolDef;
  d365ReadFormState: AgentToolDef;
  xppReadObject: AgentToolDef;
  model?: string;
  maxTurns?: number;
}

export async function runTesterAgent(
  input: TesterAgentInput,
  deps: TesterAgentDeps,
): Promise<TestReport> {
  return runAgent({
    systemPrompt: TESTER_SYSTEM_PROMPT,
    tools: [
      deps.d365Query,
      deps.d365Create,
      deps.d365Update,
      deps.d365InvokeAction,
      deps.d365ReadFormState,
      deps.xppReadObject,
    ],
    input,
    outputSchema: TestReport,
    ...(deps.model !== undefined ? { model: deps.model } : {}),
    maxTurns: deps.maxTurns ?? 40,
  });
}
