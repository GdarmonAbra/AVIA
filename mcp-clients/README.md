# External MCP servers used by AVIA

AVIA no longer ships its own MCP servers. Agents talk to existing servers launched per `mcp.json`. This file is consumed by `packages/agents/shared/src/mcpRegistry.ts`.

## Servers

| Name | Purpose | Transport | Source |
|---|---|---|---|
| `d365fo-nav` | X++ read / navigate + limited write on AxTable/AxForm (54 tools, ~584k symbols) | stdio | [dynamics365ninja/d365fo-mcp-server](https://github.com/dynamics365ninja/d365fo-mcp-server) — the single X++ surface in AVIA |
| `fo-semantic` | Semantic NL search over F&O artifacts | stdio | [xplusplusai/fo-semantic-mcp](https://github.com/xplusplusai/fo-semantic-mcp) — commercial, requires `FOINDEX_API_KEY` |
| `azure-devops` | Work items, repos, PRs, pipelines, wiki | stdio | [microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp) — official |
| `erp` | Runtime ops against a connected F&O tenant | streamable-http | [Microsoft Dynamics 365 ERP MCP (dynamic)](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/copilot/copilot-mcp) — public preview |

## Tool namespacing

All tools are exposed to agents as `${server}__${tool}` (e.g. `d365fo-nav__findTable`, `azure-devops__wit_get_work_item`) so two servers can offer same-named tools without collision. The registry maps the namespaced name back to `(server, tool)` at dispatch.

## Which agent uses what

| Agent | Servers |
|---|---|
| Summary | `azure-devops` |
| Architect | `d365fo-nav`, `fo-semantic`, `azure-devops` (read-only) |
| Developer | `d365fo-nav`, `fo-semantic` |
| Tester | `erp`, `d365fo-nav` (for read context) |

See `docs/agents.md` for the full mapping.

## Installing the servers

`d365fo-nav` is not on npm; clone and build it on your UDE box and point `MCP_D365FO_NAV_PATH` at the output directory (see `.env.example`). `fo-semantic` and `azure-devops` ship via `npx`.

For `erp`, enable the MCP feature in your F&O tenant's Feature Management, add AVIA to the Allowed MCP Clients page, and set `D365_ERP_MCP_URL` to `https://<env>.operations.dynamics.com/mcp`.
