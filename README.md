# AVIA

AI Virtual Implementation Assistant for Dynamics 365 Finance & Operations.

AVIA takes an Azure DevOps work item and drives it through a four-agent pipeline
— **Summary → Architect → Developer → Tester** — that ends with verified
behavior in a live F&O environment. Every LLM call goes through the Anthropic
Claude API; all F&O interaction goes through custom MCP servers (notably an
X++ MCP server backed by a .NET bridge).

> This repository is currently a **scaffold**. Interfaces, types, state machine,
> MCP tool surfaces, and .NET bridge shape are in place; real logic behind each
> `NotImplementedError` / `TODO(avia-###)` marker lands in follow-up PRs.

## Layout

```
packages/
  shared-types/        typed agent I/O + task state (zod)
  orchestrator/        state machine (reducer) + file-backed task store
  agents/
    shared/              Claude client + tool-use harness + prompt caching
    summary/             work item → WorkItemIntent
    architect/           intent → DesignProposal (human-approved)
    developer/           proposal → BuildArtifact (compile-fix loop)
    tester/              artifact → TestReport (drives live F&O)
  mcp-servers/
    xpp/                 X++ metadata ops; shells out to src/Avia.Xpp.Cli
    d365-runtime/        OData + Metadata Service against live F&O
    azure-devops/        work items, PRs, pipelines
  vscode-extension/      cockpit UI
src/
  Avia.Xpp.Cli/          .NET 8 bridge to the D365 metadata tools
  Avia.Xpp.Cli.Tests/
docs/
  architecture.md        end-to-end flow + state machine
  agents.md              per-agent prompt skeletons + I/O
  mcp-contracts.md       every MCP tool's JSON Schema
```

## Prerequisites

- Node 20.11+ and `pnpm` 9
- .NET 8 SDK
- An Anthropic API key (`ANTHROPIC_API_KEY`)
- For the Tester / d365-runtime: client-credentials for a real F&O env
- For the real `xpp` path: a D365 dev box with `AVIA_D365_TOOLS_PATH` pointed
  at its metadata DLL folder. On CI / without a dev box, the in-memory
  metadata provider is used automatically.

Copy `.env.example` → `.env` and fill in.

## Build & test

```bash
pnpm install
pnpm -r run build
pnpm -r run test
pnpm -r run lint

dotnet restore src/Avia.Xpp.sln
dotnet build   src/Avia.Xpp.sln
dotnet test    src/Avia.Xpp.sln
```

## Smoke checks

```bash
# MCP surface
npx @modelcontextprotocol/inspector node packages/mcp-servers/xpp/dist/server.js
npx @modelcontextprotocol/inspector node packages/mcp-servers/d365-runtime/dist/server.js
npx @modelcontextprotocol/inspector node packages/mcp-servers/azure-devops/dist/server.js

# Summary agent harness (no ADO PAT required with --work-item=mock:<id>)
pnpm --filter @avia/agents-summary start -- --work-item=mock:1

# Live F&O smoke (requires D365_* secrets)
pnpm --filter @avia/mcp-d365-runtime run smoke
```

## Safety

The Architect's `DesignProposal` is **never auto-approved**. The VS Code
extension blocks the orchestrator on `awaiting_user_approval` before any code
is written. Once approved, the Developer will compile + deploy without further
prompts, so the approval gate is the one to guard.
