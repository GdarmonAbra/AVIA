# AVIA Architecture

AVIA ("AI Virtual Implementation Assistant") is a multi-agent system that takes an Azure DevOps work item and drives it through summarization → design → implementation → live testing against a Dynamics 365 Finance & Operations environment. Every LLM call goes through the Anthropic Claude API.

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

Transitions are pure reducer calls. Side-effects (spawning an agent, writing to the task store) are handled in an outer runner so the reducer is unit-testable.

## Why four agents instead of one

Each role needs a different system prompt, tool set, and — critically — a different trust level for destructive operations:

| Agent      | Writes code? | Writes to live F&O? | Model (default)         |
|------------|:---:|:---:|---|
| Summary    | no  | no  | `claude-opus-4-7`       |
| Architect  | no  | no  | `claude-opus-4-7`       |
| Developer  | yes | no  | `claude-sonnet-4-6` (fast, it will loop) |
| Tester     | no  | yes (test data only) | `claude-sonnet-4-6` |

Prompt caching is applied to the system prompt + tool list, so the Developer's compile-fix loop stays cheap.

## MCP boundary

Agents never call F&O, ADO, or `.NET` directly. They talk to three MCP servers over stdio:

- `xpp` — read/write X++ metadata, compile, deploy. Shells out to `dotnet avia-xpp`.
- `d365-runtime` — OData + Metadata Service against a live F&O environment.
- `azure-devops` — work items, PRs, pipelines.

This keeps the agents portable (any MCP client can drive them — VS Code, Claude Desktop, our own extension, CI) and keeps auth/secrets contained in the MCP server processes.

## Human-in-the-loop

The Architect's `DesignProposal` is never auto-approved. The VS Code extension renders it and blocks the orchestrator on `awaiting_user_approval`. This is the single most important safety gate: once the Developer is unblocked, it will compile and deploy without further prompts until the Tester reports.

## Resumability

`TaskState` is written to `.avia/tasks/<id>.json` on every transition. A crashed or killed session can be resumed with `avia resume <id>` — the orchestrator reads the state and calls whichever agent owns the current state.

## File map (load-bearing)

- `packages/orchestrator/src/router.ts` — state machine
- `packages/orchestrator/src/taskStore.ts` — persistence
- `packages/agents/shared/src/harness.ts` — `runAgent(systemPrompt, tools, input)`
- `packages/agents/shared/src/claude.ts` — Anthropic client + tool-use loop + prompt caching
- `packages/mcp-servers/xpp/src/server.ts` — `xpp_*` tools, spawns `dotnet avia-xpp`
- `packages/mcp-servers/d365-runtime/src/server.ts` — `d365_*` tools
- `packages/mcp-servers/azure-devops/src/server.ts` — `ado_*` tools
- `src/Avia.Xpp.Cli/Program.cs` — .NET bridge entry point
