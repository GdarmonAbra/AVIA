# MCP Servers in use

AVIA no longer defines its own MCP tool surfaces — it binds to existing servers. Tool contracts are owned by those servers; their READMEs are the source of truth. What follows is an integration summary.

| Name in `mcp.json` | Source | Install | Transport | Notes |
|---|---|---|---|---|
| `xpp-author` | [ccampora/mcp_xpp](https://github.com/ccampora/mcp_xpp) (MIT) | Clone + `npm install` + `.\tools\build-and-run.ps1 -Action build`; set `MCP_XPP_PATH` | stdio | Write-capable X++ authoring. Uses Named Pipes to a C# .NET 4.8 service; requires VS2022 + D365 dev tools on the host. 10 tools incl. `create_xpp_object`, `create_form`, `delete_xpp_object`, `execute_object_modification`, `find_xpp_object`, `inspect_xpp_object`, `build_object_index`. |
| `d365fo-nav` | [dynamics365ninja/d365fo-mcp-server](https://github.com/dynamics365ninja/d365fo-mcp-server) (MIT) | Clone + `npm install` + `npm run extract-metadata` + `npm run build-database`; set `MCP_D365FO_NAV_PATH` | stdio | 54 tools over ~584k indexed symbols. Metadata lookup, CoC detection, security hierarchy, labels, table relations, XML-based table/form generation. Some write capability on `AxTable` / `AxForm`. |
| `fo-semantic` | [xplusplusai/fo-semantic-mcp](https://github.com/xplusplusai/fo-semantic-mcp) (commercial) | `npx -y fo-semantic-mcp`; needs `FOINDEX_API_KEY`, `FO_LOCAL_ASSETS_PATH` | stdio | 2 tools: `search_FO_artifacts` (NL semantic search over 166k+ artifacts), `fo-development-assistant` (guided workflow). |
| `azure-devops` | [microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp) (MIT) | `npx -y @azure-devops/mcp <org>`; browser Entra auth on first run | stdio | Domains: `core`, `work`, `work-items`, `search`, `test-plans`, `repositories`, `wiki`, `pipelines`, `advanced-security`. |
| `erp` | [Microsoft Dynamics 365 ERP MCP (dynamic)](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/copilot/copilot-mcp) | Enable feature in F&O Feature Management + allow-list AVIA on "Allowed MCP Clients" page | streamable-http | URL `https://<env>.operations.dynamics.com/mcp`. Dynamic tool list. Requires F&O ≥ 10.0.47 and Tier-2 or a UDE. Entra client-credentials auth. Public preview. |

## How AVIA binds to them

`mcp-clients/mcp.json` has a `mcpServers` entry for each server. `${VAR}` placeholders are expanded from `process.env` at load time by `packages/agents/shared/src/mcpRegistry.ts`. Tool names are namespaced `${server}__${tool}` — so `xpp-author__create_xpp_object`, `azure-devops__wit_get_work_item`, etc. — and the adapter maps them back at dispatch.

## Auth summary

- `azure-devops`: Entra device login on first `npx` run, cached per host.
- `erp`: OAuth 2.0 client-credentials against `https://login.microsoftonline.com/<tenant>/oauth2/token`, resource = F&O base URL. Token minted by AVIA and passed as `Authorization: Bearer` on the streamable-http transport.
- `xpp-author`, `d365fo-nav`, `fo-semantic`: no runtime auth (local / API-key-only).

## Error envelope

AVIA's adapter normalizes failing `callTool` responses (`isError: true`) into:

```ts
{ error: { code: "mcp_tool_error", message: "<stringified content>" } }
```

Agents' system prompts instruct them that this is a recoverable signal — try an alternate approach before giving up.
