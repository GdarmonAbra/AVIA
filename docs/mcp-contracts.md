# MCP Contracts

Each server registers its tools on stdio via `@modelcontextprotocol/sdk`. All inputs/outputs are validated with `zod` on both sides. Errors are returned as structured `{ error: { code, message, details? } }` payloads, not exceptions, so agents can reason about them.

## `xpp` server

Owner: `packages/mcp-servers/xpp`. Shells out to `dotnet avia-xpp <verb> --json`.

### `xpp_find_object`
```ts
input: { type: XppObjectType, query: string, model?: string }
output: { matches: Array<{ type, name, model, path }> }
```

### `xpp_read_object`
```ts
input: { type: XppObjectType, name: string, model?: string }
output: { object: XppObject } // full metadata + source where applicable
```

### `xpp_create_object`
```ts
input: { type: XppObjectType, name: string, model: string, properties: Record<string, unknown> }
output: { object: XppObject }
```

### `xpp_update_object`
```ts
input: { type, name, model, patch: JsonPatch }
output: { object: XppObject }
```

### `xpp_compile`
```ts
input: { model?: string, project?: string }
output: { ok: boolean, errors: CompileDiagnostic[], warnings: CompileDiagnostic[], log: string }
```

### `xpp_deploy`
```ts
input: { model: string, env: "uat" | "sandbox" | "dev" }
output: { ok: boolean, deploymentId: string }
```

### `xpp_sync_db`
```ts
input: { model: string }
output: { ok: boolean, log: string }
```

`XppObjectType` = `"table" | "form" | "class" | "enum" | "view" | "query" | "menuItem" | "edt" | "map"` (see `packages/shared-types/src/index.ts`).

## `d365-runtime` server

Owner: `packages/mcp-servers/d365-runtime`. Uses client-credentials OAuth against `D365_RESOURCE`.

### `d365_query`
```ts
input: { entity: string, filter?: string, select?: string[], top?: number }
output: { value: Record<string, unknown>[] }
```

### `d365_create`
```ts
input: { entity: string, payload: Record<string, unknown> }
output: { record: Record<string, unknown> }
```

### `d365_update`
```ts
input: { entity: string, key: Record<string, unknown>, patch: Record<string, unknown> }
output: { record: Record<string, unknown> }
```

### `d365_invoke_action`
```ts
input: { action: string, payload?: Record<string, unknown> }
output: { result: unknown }
```

### `d365_read_form_state`
```ts
input: { form: string, args?: Record<string, unknown> }
output: { fields: Record<string, unknown>, validations: string[] } // via Metadata Service
```

## `azure-devops` server

Owner: `packages/mcp-servers/azure-devops`. Uses PAT auth from `ADO_PAT`.

### `ado_get_work_item`
```ts
input: { id: number }
output: { workItem: { id, title, description, state, type, acceptanceCriteria?, fields } }
```

### `ado_update_work_item`
```ts
input: { id: number, patch: Array<{ op: "add" | "replace", path: string, value: unknown }> }
output: { workItem: { id, rev } }
```

### `ado_create_pull_request`
```ts
input: { repo: string, source: string, target: string, title: string, body: string }
output: { pullRequest: { id, url } }
```

### `ado_get_build_status`
```ts
input: { id: number }
output: { build: { id, status, result } }
```

## Error envelope

Any tool can return:
```ts
{ error: { code: string, message: string, details?: unknown } }
```

Agents are instructed in their system prompts that this is a recoverable signal, not a stop condition — they should read `error.code` and try an alternate approach before giving up.
