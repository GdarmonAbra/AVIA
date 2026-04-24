# Agents

All agents share `packages/agents/shared` — one `runAgent(systemPrompt, tools, input)` harness built on Anthropic tool-use with **prompt caching** on the system prompt + tool list, and `claude-opus-4-7` as the default model. The Developer uses `claude-sonnet-4-6` for its compile-fix loop; the Tester uses `claude-sonnet-4-6` to align with Microsoft's Sonnet-4.5 recommendation for the ERP MCP (4.6 is the current-gen equivalent).

All agent runners accept `tools: AgentToolDef[]` directly — the caller builds the tool list from the MCP registry.

## Summary

- **Input**: `{ workItemId }`
- **Tools**: `registry.tools("azure-devops")`
- **Output**: `WorkItemIntent`
- **Prompt**: `packages/agents/summary/src/prompt.ts`

## Architect

- **Input**: `WorkItemIntent`
- **Tools**: `registry.toolsFor("d365fo-nav", "fo-semantic", "azure-devops")` — all read-only for this agent
- **Output**: `DesignProposal` — the orchestrator transitions to `awaiting_user_approval` and blocks until the user approves/rejects via the VS Code extension

## Developer

- **Input**: approved `DesignProposal`
- **Tools**: `registry.toolsFor("xpp-author", "d365fo-nav", "fo-semantic")`
- **Output**: `BuildArtifact`
- **Inner loop**: `write → compile → on error, fix → retry` up to `maxTurns` (default 60). On success, call `xpp-author`'s deploy tool.

## Tester

- **Input**: `{ artifact, acceptance, taskId }`
- **Tools**: `registry.toolsFor("erp", "d365fo-nav")`. The `erp` server is Microsoft's Dynamics 365 ERP MCP (dynamic). `d365fo-nav` is used for read-only metadata context.
- **Output**: `TestReport`
- **Loop**: on `pass: false` the orchestrator routes failures back to the Developer with the `TestReport` attached (bounded).

## Shared harness

`runAgent({ systemPrompt, tools, input, outputSchema, model })` wraps the Anthropic tool-use loop:

1. Marks `systemPrompt` and the last tool in the list as ephemeral cache breakpoints.
2. Sends the initial user message (`JSON.stringify(input)`).
3. Loops: if the response contains `tool_use` blocks, dispatches to the bound tool and appends a `tool_result` turn; otherwise parses the final assistant text as JSON and validates with the agent's output schema (zod).
4. Enforces a per-agent max-tokens budget and max-turn count.

No agent should construct an Anthropic client directly.
