#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DotnetBridge } from "./dotnetBridge.js";

const bridge = new DotnetBridge();

const TOOLS = [
  {
    name: "xpp_find_object",
    description: "Find X++ objects matching a query.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["table", "form", "class", "enum", "view", "query", "menuItem", "edt", "map"],
        },
        query: { type: "string" },
        model: { type: "string" },
      },
      required: ["type", "query"],
    },
    verb: "find",
  },
  {
    name: "xpp_read_object",
    description: "Read a single X++ object's metadata (and source, if applicable).",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string" },
        name: { type: "string" },
        model: { type: "string" },
      },
      required: ["type", "name"],
    },
    verb: "read",
  },
  {
    name: "xpp_create_object",
    description: "Create a new X++ object.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string" },
        name: { type: "string" },
        model: { type: "string" },
        properties: { type: "object" },
      },
      required: ["type", "name", "model", "properties"],
    },
    verb: "create",
  },
  {
    name: "xpp_update_object",
    description: "Apply a JSON patch to an X++ object's metadata.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string" },
        name: { type: "string" },
        model: { type: "string" },
        patch: { type: "array" },
      },
      required: ["type", "name", "model", "patch"],
    },
    verb: "update",
  },
  {
    name: "xpp_compile",
    description: "Compile a model or project and return diagnostics.",
    inputSchema: {
      type: "object",
      properties: { model: { type: "string" }, project: { type: "string" } },
    },
    verb: "compile",
  },
  {
    name: "xpp_sync_db",
    description: "Run the database sync for a model.",
    inputSchema: {
      type: "object",
      properties: { model: { type: "string" } },
      required: ["model"],
    },
    verb: "sync-db",
  },
  {
    name: "xpp_deploy",
    description: "Deploy a compiled model to a target environment.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        env: { type: "string", enum: ["uat", "sandbox", "dev"] },
      },
      required: ["model", "env"],
    },
    verb: "deploy",
  },
] as const;

export function createServer(
  deps: { bridge: Pick<DotnetBridge, "invoke"> } = { bridge },
): Server {
  const server = new Server(
    { name: "avia-xpp", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(({ verb: _verb, ...t }) => t),
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
      const out = await deps.bridge.invoke(def.verb, request.params.arguments ?? {});
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: {
                code: "bridge_error",
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
