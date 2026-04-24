#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createOdataClient,
  loadConfigFromEnv,
  type OdataClient,
} from "./odataClient.js";

const TOOLS = [
  {
    name: "d365_query",
    description: "OData GET against an F&O entity.",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string" },
        filter: { type: "string" },
        select: { type: "array", items: { type: "string" } },
        top: { type: "number" },
      },
      required: ["entity"],
    },
    dispatch: (c: OdataClient, a: unknown) =>
      c.query(a as Parameters<OdataClient["query"]>[0]),
  },
  {
    name: "d365_create",
    description: "OData POST to create a record.",
    inputSchema: {
      type: "object",
      properties: { entity: { type: "string" }, payload: { type: "object" } },
      required: ["entity", "payload"],
    },
    dispatch: (c: OdataClient, a: unknown) =>
      c.create(a as Parameters<OdataClient["create"]>[0]),
  },
  {
    name: "d365_update",
    description: "OData PATCH to update a record.",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string" },
        key: { type: "object" },
        patch: { type: "object" },
      },
      required: ["entity", "key", "patch"],
    },
    dispatch: (c: OdataClient, a: unknown) =>
      c.update(a as Parameters<OdataClient["update"]>[0]),
  },
  {
    name: "d365_invoke_action",
    description: "Invoke a bound or unbound OData action.",
    inputSchema: {
      type: "object",
      properties: { action: { type: "string" }, payload: { type: "object" } },
      required: ["action"],
    },
    dispatch: (c: OdataClient, a: unknown) =>
      c.invokeAction(a as Parameters<OdataClient["invokeAction"]>[0]),
  },
  {
    name: "d365_read_form_state",
    description:
      "Read form metadata + current state via the Metadata Service (used to verify UI rules).",
    inputSchema: {
      type: "object",
      properties: { form: { type: "string" }, args: { type: "object" } },
      required: ["form"],
    },
    dispatch: (c: OdataClient, a: unknown) =>
      c.readFormState(a as Parameters<OdataClient["readFormState"]>[0]),
  },
] as const;

export function createServer(client?: OdataClient): Server {
  const resolvedClient = client ?? createOdataClient(loadConfigFromEnv());

  const server = new Server(
    { name: "avia-d365-runtime", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(({ dispatch: _d, ...t }) => t),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const def = TOOLS.find((t) => t.name === request.params.name);
    if (!def) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: { code: "unknown_tool", message: request.params.name },
            }),
          },
        ],
      };
    }
    try {
      const out = await def.dispatch(resolvedClient, request.params.arguments ?? {});
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: {
                code: "odata_error",
                message: err instanceof Error ? err.message : String(err),
              },
            }),
          },
        ],
      };
    }
  });

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
