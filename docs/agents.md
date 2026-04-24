# Agents

All agents share `packages/agents/shared`. They differ in system prompt, available tools, and output schema (validated with `zod` before being returned to the orchestrator).

## Summary

- **Input**: `{ workItemId: string }`
- **Output**: `WorkItemIntent { goal, acceptance[], scope, risks[] }`
- **Tools**: `ado_get_work_item`
- **Prompt skeleton** (see `packages/agents/summary/src/prompt.ts` — TODO):
  > You are the Summary agent. Read the Azure DevOps work item, strip marketing language, and produce the *true intent*: the user-visible behavior change, acceptance criteria, and scope. Do not speculate about implementation. If the ticket is ambiguous, list the ambiguities.

## Architect

- **Input**: `WorkItemIntent`
- **Output**: `DesignProposal { summary, changes[], acceptance[], risks[] }`
- **Tools**: `xpp_find_object`, `xpp_read_object`, `ado_get_work_item` (read-only surface)
- **Handoff**: the orchestrator transitions to `awaiting_user_approval` and blocks until the user approves/rejects/edits the proposal via the VS Code extension.
- **Prompt skeleton**:
  > You are the Architect agent for Dynamics 365 F&O. Given the intent, inspect existing objects (tables, forms, classes) to do a fit/gap analysis. Propose the minimum set of metadata changes that satisfies the acceptance criteria. Prefer extensions over overlayering.

## Developer

- **Input**: approved `DesignProposal`
- **Output**: `BuildArtifact { model, env, compileLog, deploymentId }`
- **Tools**: all of `xpp_*`
- **Inner loop**: `write → compile → on error, fix → retry` up to `maxCompileLoops` (default 8). On success, call `xpp_deploy`.
- **Prompt skeleton**:
  > You are the Developer agent. Implement exactly the changes in the approved DesignProposal. Use the xpp_* tools to read existing code for context, then create/update objects. After every change, run xpp_compile and fix errors until clean. Do not expand the scope.

## Tester

- **Input**: `{ artifact: BuildArtifact, acceptance: string[] }`
- **Output**: `TestReport { pass: boolean, results: TestResult[] }`
- **Tools**: all of `d365_*`, `xpp_read_object` (for context)
- **Behavior**: drives the live F&O environment via OData and Metadata Service to verify each acceptance criterion. It creates test records with an `Avia-Test-<taskId>` tag so cleanup is trivial.
- **Loop**: on `pass: false`, the orchestrator routes the failures back to the Developer with the `TestReport` attached.
- **Prompt skeleton**:
  > You are the Tester agent. For each acceptance criterion, design a minimal scenario that exercises it against the live F&O environment. Use the d365_* tools. Tag every record you create with Avia-Test-<taskId>. Report each criterion as pass or fail with the exact tool calls and responses that prove it.

## Shared harness

`runAgent({ systemPrompt, tools, input, model })` wraps the Anthropic tool-use loop:

1. Marks `systemPrompt` and `tools` as cache breakpoints (`cache_control: { type: "ephemeral" }`).
2. Sends the initial user message (`JSON.stringify(input)`).
3. Loops: if the response contains `tool_use` blocks, dispatches to the bound MCP tool and appends a `tool_result` turn; otherwise, parses the final assistant message as JSON and validates with the agent's output schema.
4. Enforces a per-agent max-tokens budget and max-turn count.

All agents call `runAgent` — no agent should construct an Anthropic client directly.
