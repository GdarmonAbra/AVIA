import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { runArchitectAgent } from "@avia/agents-architect";
import { runDeveloperAgent } from "@avia/agents-developer";
import { loadMcpConfig, type McpRegistry } from "@avia/agents-shared";
import { runSummaryAgent } from "@avia/agents-summary";
import { runTesterAgent } from "@avia/agents-tester";
import { FileTaskStore, reduce, type Event, type TaskStore } from "@avia/orchestrator";
import type {
  BuildArtifact,
  DesignProposal,
  TaskState,
  TestReport,
  WorkItemIntent,
} from "@avia/shared-types";

/**
 * Things the runner needs that aren't pure code — split out so tests can
 * stub the registry, the store, and the human-in-the-loop without spinning
 * up real MCP servers.
 */
export interface RunnerDeps {
  registry: McpRegistry;
  store: TaskStore;
  approver: (proposal: DesignProposal) => Promise<boolean>;
  logger?: (line: string) => void;
  agents?: {
    summary?: typeof runSummaryAgent;
    architect?: typeof runArchitectAgent;
    developer?: typeof runDeveloperAgent;
    tester?: typeof runTesterAgent;
  };
  now?: () => string;
}

export type StopAfter = "summary" | "design" | "dev" | "test";

export interface RunOptions {
  workItemId: string | number;
  taskId?: string;
  stopAfter?: StopAfter;
  autoApprove?: boolean;
}

export interface RunResult {
  final: TaskState;
  stoppedEarly: boolean;
}

/**
 * Drive the task state machine from `created` to a terminal state (or to the
 * configured `stopAfter` boundary). Each step: run the right agent, dispatch
 * the event, persist, repeat. All side effects flow through the injected deps.
 */
export async function run(opts: RunOptions, deps: RunnerDeps): Promise<RunResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const log = deps.logger ?? ((line: string) => console.log(line));
  const agents = {
    summary: deps.agents?.summary ?? runSummaryAgent,
    architect: deps.agents?.architect ?? runArchitectAgent,
    developer: deps.agents?.developer ?? runDeveloperAgent,
    tester: deps.agents?.tester ?? runTesterAgent,
  };

  const taskId = opts.taskId ?? `task_${String(opts.workItemId)}`;
  const stopAfter = opts.stopAfter;

  let state: TaskState = (await deps.store.load(taskId)) ?? {
    id: taskId,
    workItemId: opts.workItemId,
    status: "created",
    createdAt: now(),
    updatedAt: now(),
    devTestLoops: 0,
    history: [],
  };

  const dispatch = async (event: Event): Promise<void> => {
    state = reduce(state, event);
    await deps.store.save(state);
    log(`[${state.id}] → ${state.status}`);
  };

  if (state.status === "created") {
    await dispatch({ type: "START", at: now() });
  }

  while (!isTerminal(state.status)) {
    try {
      switch (state.status) {
        case "summarizing": {
          const tools = await deps.registry.tools("azure-devops");
          const intent: WorkItemIntent = await agents.summary(
            { workItemId: opts.workItemId },
            { tools },
          );
          await dispatch({ type: "SUMMARY_COMPLETED", at: now(), intent });
          if (stopAfter === "summary") return { final: state, stoppedEarly: true };
          break;
        }

        case "designing": {
          if (!state.intent) throw new Error("designing without intent");
          const tools = await deps.registry.toolsFor(
            "d365fo-nav",
            "fo-semantic",
            "azure-devops",
          );
          const proposal: DesignProposal = await agents.architect(state.intent, {
            tools,
          });
          await dispatch({ type: "DESIGN_COMPLETED", at: now(), proposal });
          if (stopAfter === "design") return { final: state, stoppedEarly: true };
          break;
        }

        case "awaiting_user_approval": {
          if (!state.proposal) throw new Error("approval without proposal");
          const approved = opts.autoApprove
            ? true
            : await deps.approver(state.proposal);
          await dispatch(
            approved
              ? { type: "USER_APPROVED", at: now() }
              : { type: "USER_REJECTED", at: now(), reason: "user declined" },
          );
          break;
        }

        case "developing": {
          if (!state.proposal) throw new Error("developing without proposal");
          const tools = await deps.registry.toolsFor("d365fo-nav", "fo-semantic");
          const artifact: BuildArtifact = await agents.developer(state.proposal, {
            tools,
          });
          await dispatch({ type: "DEV_COMPLETED", at: now(), artifact });
          if (stopAfter === "dev") return { final: state, stoppedEarly: true };
          break;
        }

        case "testing": {
          if (!state.artifact) throw new Error("testing without artifact");
          if (!state.intent) throw new Error("testing without intent");
          const tools = await deps.registry.toolsFor("erp", "d365fo-nav");
          const report: TestReport = await agents.tester(
            {
              artifact: state.artifact,
              acceptance: state.intent.acceptance,
              taskId: state.id,
            },
            { tools },
          );
          await dispatch({ type: "TEST_COMPLETED", at: now(), report });
          if (stopAfter === "test") return { final: state, stoppedEarly: true };
          break;
        }

        default:
          throw new Error(`unexpected state: ${state.status}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log(`[${state.id}] ABORT: ${reason}`);
      await dispatch({ type: "ABORT", at: now(), reason });
      break;
    }
  }

  return { final: state, stoppedEarly: false };
}

function isTerminal(status: TaskState["status"]): boolean {
  return (
    status === "done" ||
    status === "failed" ||
    status === "rejected" ||
    status === "aborted"
  );
}

/**
 * Default deps: load mcp.json from disk, persist tasks under `.avia/tasks`,
 * and prompt the human on the TTY for design approval.
 */
export async function defaultDeps(args: {
  mcpConfigPath: string;
  taskDir: string;
}): Promise<RunnerDeps> {
  const registry = await loadMcpConfig(args.mcpConfigPath);
  return {
    registry,
    store: new FileTaskStore(args.taskDir),
    approver: ttyApprover,
  };
}

async function ttyApprover(proposal: DesignProposal): Promise<boolean> {
  output.write("\n─── DesignProposal ─────────────────────────────────────\n");
  output.write(`${proposal.summary}\n`);
  output.write(`changes: ${proposal.changes.length}\n`);
  for (const c of proposal.changes) {
    output.write(`  - [${c.operation}] ${c.objectType} ${c.objectName} (${c.model})\n`);
  }
  if (proposal.risks.length > 0) {
    output.write(`risks:\n`);
    for (const r of proposal.risks) output.write(`  - ${r}\n`);
  }
  output.write("────────────────────────────────────────────────────────\n");
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question("Approve design? [y/N] ")).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
