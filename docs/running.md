# Running AVIA

This doc covers how to drive the agent pipeline end-to-end. The runtime is a
small CLI (`@avia/cli`) that walks a work item through Summary → Architect →
(human approval) → Developer → Tester, persisting state after each step.

## 1. Prerequisites

AVIA generates X++ inside a **regular Visual Studio 2022 solution + Dynamics
365 F&O project** — exactly what a human F&O developer would commit. That
shape is produced by `d365fo-nav` and compiled through the standard VS2022
MSBuild pipeline. Functional tests run against a live F&O instance through the
Microsoft Dynamics 365 ERP MCP.

You need:

- A **Windows Unified Developer Experience (UDE) box** with
  - Visual Studio 2022 + Dynamics 365 F&O dev tools,
  - A local AOS / PackagesLocalDirectory you can write to,
  - Node.js 20.11+ and pnpm 9 installed.
- An **Azure DevOps PAT** with read access to your work items.
- An **Anthropic API key** (`ANTHROPIC_API_KEY`).
- OAuth client credentials for the **Microsoft Dynamics 365 ERP MCP** (see its
  docs) — tenant id, client id, client secret, and the F&O resource URL.

## 2. Install the MCP servers

Only `d365fo-nav` needs to be cloned + built. The others come from npm at
runtime via `npx`, or are hosted HTTP services.

```powershell
# On the UDE box
git clone https://github.com/dynamics365ninja/d365fo-mcp-server.git
cd d365fo-mcp-server
npm install
npm run extract-metadata   # one-time, ~30 min for a full model index
npm run build-database
npm run build
```

Point `MCP_D365FO_NAV_PATH` at the repo root (the folder with `build/index.js`).

`fo-semantic` and `azure-devops` resolve via `npx` the first time they're
used — no manual install needed.

## 3. Configure the environment

Copy `.env.example` to `.env` (or set the vars in your shell) and fill in:

```bash
ANTHROPIC_API_KEY=sk-ant-...

# Azure DevOps MCP
ADO_ORG=https://dev.azure.com/yourorg
ADO_PAT=...

# d365fo-nav / fo-semantic
MCP_D365FO_NAV_PATH=C:\src\d365fo-mcp-server
AVIA_D365_METADATA_PATH=C:\AosService\PackagesLocalDirectory

# Microsoft ERP MCP (Entra client credentials)
ERP_MCP_URL=https://<your-f&o-host>/mcp
ERP_TENANT_ID=...
ERP_CLIENT_ID=...
ERP_CLIENT_SECRET=...
ERP_RESOURCE=https://<your-f&o-host>
```

`mcp-clients/mcp.json` expands `${VAR}` placeholders against the shell
environment when the registry is loaded, so every agent sees the same
credentials without the secrets being checked in.

## 4. Install and build

```bash
pnpm install
pnpm -r build
```

This produces `packages/cli/dist/index.js` with a `#!/usr/bin/env node`
shebang and wires it as the `avia` bin inside the workspace.

## 5. Run the pipeline

The minimal invocation takes a work item id:

```bash
pnpm --filter @avia/cli exec avia --work-item 1234
```

What happens:

1. Summary reads ADO item 1234 → emits a `WorkItemIntent`.
2. Architect reads the model via `d365fo-nav` + `fo-semantic` → emits a
   `DesignProposal` (list of `DesignChange` items).
3. The CLI prints the proposal and asks `Approve design? [y/N]`.
4. On approval, Developer executes the changes via `d365fo-nav`, creating /
   updating the `.sln` and `.rnrproj` files, then triggers MSBuild and DB
   sync, and deploys. Output: a `BuildArtifact` with the solution + project
   paths.
5. Tester drives the live F&O app via the `erp` MCP for each acceptance
   criterion → emits a `TestReport`. A passing report takes the task to
   `done`; a failing report loops back to Developer (up to 3 cycles).

State is persisted after every transition under `.avia/tasks/<taskId>.json`,
so a run can be resumed with the same `--task-id`.

### Useful flags

| Flag | Effect |
|---|---|
| `--task-id <id>` | Override the generated task id (default `task_<workItem>`). |
| `--mcp-config <path>` | Use a different `mcp.json` (default `./mcp-clients/mcp.json`). |
| `--task-dir <path>` | Where to write state blobs (default `./.avia/tasks`). |
| `--stop-after summary\|design\|dev\|test` | Halt after the named stage. |
| `--auto-approve` | Skip the design y/N prompt (for CI / scripted runs). |

### Dry run (no UDE needed)

On a laptop with just `ANTHROPIC_API_KEY` + `ADO_PAT`, you can exercise the
first two stages to validate prompts + tool wiring without touching F&O:

```bash
pnpm --filter @avia/cli exec avia \
  --work-item 1234 \
  --stop-after design
```

This runs Summary + Architect (needs `azure-devops` + `fo-semantic`, both via
`npx`) and prints the proposal. The task is left in `awaiting_user_approval`
so you can resume it from the UDE box later.

## 6. What the Developer produces

Every successful Developer run writes a `BuildArtifact` with:

- `solutionPath` — absolute path to a standard VS2022 `.sln` under the
  model's `VSProjects` folder,
- `projects[]` — one `.rnrproj` per touched D365 F&O model, each added to
  the `.sln`,
- `configuration` — `Debug` or `Release`,
- `compileLog` — the full MSBuild output,
- `deploymentId` + `deployedAt` — from the deploy tool.

A human reviewer can open the `.sln` in VS2022 and see every created/modified
object in Solution Explorer, ready for normal code review before it ships.

## 7. Troubleshooting

- **`MCP server 'X' is not configured`** — check `mcp-clients/mcp.json` and
  that the corresponding `${VAR}` is set in your environment.
- **Namespaced tool name > 64 chars** — shorten the server key in
  `mcp.json` (e.g. rename `azure-devops` to `ado`) and update the
  `toolsFor(...)` calls.
- **Compile hangs in the dev→compile loop** — `maxTurns` (default 60) will
  trip and emit `failed` with the last MSBuild errors. Fix the design or the
  prompt and re-run with the same `--task-id`.
- **Tester can't discover a tool for an AC** — that criterion is marked
  failed with a `failureReason` naming exactly what's missing; extend the ERP
  MCP or weaken the AC.
