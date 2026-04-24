# AVIA Architecture

AVIA ("AI Virtual Implementation Assistant") is a multi-agent system that takes an Azure DevOps work item and drives it through summarization → design → implementation → live testing against a Dynamics 365 Finance & Operations environment. Every LLM call goes through the Anthropic Claude API. Every F&O / ADO interaction goes through an **existing** MCP server — AVIA does not ship its own.

## High-level flow

```
Azure DevOps  ──► Summary ──► Architect ──(user approves)──► Developer ──► Tester
   work item      (intent)     (design)                       (code +       (live
                                                               compile +     F&O
                                                               deploy)       drive)
                                         ▲                                    │
                                         └──────── on failure ────────────────┘
```

The **Orchestrator** in `packages/orchestrator` owns the state machine. It is **not** an LLM. Its job:

1. Receive a trigger (VS Code command, CLI, or webhook).
2. Load/create a `TaskState` from `.avia/tasks/<id>.json`.
3. Advance the state machine by invoking exactly one agent at a time, passing the previous agent's typed output as input.
4. Persist after every transition so crashes are resumable.

## State machine

States (see `packages/orchestrator/src/router.ts`):

- `created`
- `summarizing` → `summarized`
- `designing` → `awaiting_user_approval` → `approved` | `rejected`
- `developing` (loops on compile errors) → `built`
- `testing` (loops back to `developing` on test failure, bounded by `maxDevTestLoops`) → `passed` | `failed`
- `done` | `aborted`

Transitions are pure reducer calls. Side effects (spawning an agent, writing to the task store) are handled in an outer runner so the reducer is unit-testable.

## Agents

Each role needs a different system prompt, tool set, and trust level:

| Agent      | Writes code? | Writes to live F&O? | Model (default)      |
|------------|:---:|:---:|---|
| Summary    | no  | no  | `claude-opus-4-7`    |
| Architect  | no  | no  | `claude-opus-4-7`    |
| Developer  | yes | no  | `claude-sonnet-4-6` (fast, it will loop) |
| Tester     | no  | yes (test data only) | `claude-sonnet-4-6` (Microsoft recommends Sonnet 4.5 with the ERP MCP; 4.6 is the current-gen equivalent) |

Prompt caching is applied to the system prompt + tool list, so the Developer's compile-fix loop stays cheap.

## MCP boundary

Agents never call F&O, ADO, or the D365 metadata tools directly. They talk to existing MCP servers listed in `mcp-clients/mcp.json`. `packages/agents/shared/src/mcpRegistry.ts` loads that file, spawns (or opens HTTP connections to) the servers, and adapts each server's tools into `AgentToolDef`s. Tool names are namespaced `${server}__${tool}` to avoid collisions.

See `docs/mcp-contracts.md` for the exact server list and which agents bind to which servers.

## Human-in-the-loop

The Architect's `DesignProposal` is never auto-approved. The VS Code extension renders it and blocks the orchestrator on `awaiting_user_approval`. Once the Developer is unblocked it will compile and deploy without further prompts, so this is the single most important safety gate.

## Resumability

`TaskState` is written to `.avia/tasks/<id>.json` on every transition. A crashed or killed session can be resumed with `avia resume <id>` — the orchestrator reads the state and calls whichever agent owns the current state.

## File map (load-bearing)

- `mcp-clients/mcp.json` — external MCP server launch specs
- `packages/agents/shared/src/mcpClient.ts` — stdio + streamable-http MCP client with Entra client-credentials auth for the ERP MCP
- `packages/agents/shared/src/mcpRegistry.ts` — load mcp.json, lazy-connect, list+adapt tools
- `packages/agents/shared/src/harness.ts` — Claude tool-use loop with prompt caching
- `packages/orchestrator/src/router.ts` — state machine
- `packages/orchestrator/src/taskStore.ts` — persistence
