# AVIA

AI Virtual Implementation Assistant for Dynamics 365 Finance & Operations.

AVIA takes an Azure DevOps work item and drives it through a four-agent pipeline
— **Summary → Architect → Developer → Tester** — that ends with verified
behavior in a live F&O environment. Every LLM call goes through the Anthropic
Claude API; every F&O / ADO interaction goes through an **existing** MCP
server (AVIA does not ship its own).

> This repository is currently a **scaffold**. Interfaces, types, state machine,
> and the MCP client adapter are in place; real prompt engineering, UI, and
> orchestrator runner land in follow-up PRs (grep `TODO(avia-...)`).

## Layout

```
mcp-clients/
  mcp.json             launch specs for external MCP servers
  README.md            which servers, what they do, how to install
packages/
  shared-types/        typed agent I/O + task state (zod)
  orchestrator/        state machine (reducer) + file-backed task store
  agents/
    shared/              Claude tool-use harness + prompt caching + MCP client + registry
    summary/             work item → WorkItemIntent
    architect/           intent → DesignProposal (human-approved)
    developer/           proposal → BuildArtifact (compile-fix loop)
    tester/              artifact → TestReport (drives live F&O via Microsoft's ERP MCP)
  vscode-extension/      cockpit UI (runs the orchestrator)
docs/
  architecture.md        end-to-end flow + state machine
  agents.md              per-agent prompts + which MCP servers each binds to
  mcp-contracts.md       integration notes for every external server we bind to
```

## External MCP servers

AVIA does **not** write its own X++, ADO, or OData MCP servers. It binds to:

| Name | Source | Role |
|---|---|---|
| `d365fo-nav` | [dynamics365ninja/d365fo-mcp-server](https://github.com/dynamics365ninja/d365fo-mcp-server) | The single X++ surface AVIA uses — 54 tools for read/navigation + limited `AxTable`/`AxForm` writes |
| `fo-semantic` | [xplusplusai/fo-semantic-mcp](https://github.com/xplusplusai/fo-semantic-mcp) | Semantic NL search across F&O artifacts (commercial) |
| `azure-devops` | [microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp) | Work items, repos, PRs, pipelines |
| `erp` | [Microsoft Dynamics 365 ERP MCP (dynamic)](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/copilot/copilot-mcp) | Live F&O runtime ops for the Tester agent |

Config in `mcp-clients/mcp.json`. See `mcp-clients/README.md` for install steps.

## Prerequisites

- Node 20.11+ and `pnpm` 9
- An Anthropic API key (`ANTHROPIC_API_KEY`)
- A Windows UDE box with VS2022 + D365 dev tools for `d365fo-nav`
- An F&O cloud tenant (≥ 10.0.47, Tier-2 or UDE) with the ERP MCP feature enabled and AVIA allow-listed, for the Tester agent
- Entra app registration for `erp` client-credentials auth

Copy `.env.example` → `.env` and fill in.

## Build & test

```bash
pnpm install
pnpm -r run build
pnpm -r run test
pnpm -r run lint
```

## Smoke checks

```bash
# Summary agent against a mocked ADO tool (no tenant needed, exercises Claude loop)
pnpm --filter @avia/agents-summary start -- --work-item=mock:1

# Summary agent against the real azure-devops MCP
ADO_ORG=your-org pnpm --filter @avia/agents-summary start -- --work-item=1234
```

## Safety

The Architect's `DesignProposal` is **never auto-approved**. The VS Code
extension blocks the orchestrator on `awaiting_user_approval` before any code
is written. Once approved, the Developer will compile + deploy without further
prompts, so that approval gate is the one to guard.
