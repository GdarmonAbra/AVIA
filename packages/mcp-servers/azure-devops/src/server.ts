#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createAdoClient,
  loadConfigFromEnv,
  type AdoClient,
} from "./adoClient.js";

const TOOLS = [
  {
    name: "ado_get_work_item",
    description: "Fetch an Azure DevOps work item by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: ["string", "number"] } },
      required: ["id"],
    },
    dispatch: (c: AdoClient, a: unknown) =>
      c.getWorkItem(a as Parameters<AdoClient["getWorkItem"]>[0]),
  },
  {
    name: "ado_update_work_item",
    description: "Patch fields on an Azure DevOps work item.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: ["string", "number"] },
        patch: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["add", "replace"] },
              path: { type: "string" },
              value: {},
            },
            required: ["op", "path", "value"],
          },
        },
      },
      required: ["id", "patch"],
    },
    dispatch: (c: AdoClient, a: unknown) =>
      c.updateWorkItem(a as Parameters<AdoClient["updateWorkItem"]>[0]),
  },
  {
    name: "ado_create_pull_request",
    description: "Open a pull request in an Azure Repos repo.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        source: { type: "string" },
        target: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
      },
      required: ["repo", "source", "target", "title", "body"],
    },
    dispatch: (c: AdoClient, a: unknown) =>
      c.createPullRequest(a as Parameters<AdoClient["createPullRequest"]>[0]),
  },
  {
    name: "ado_get_build_status",
    description: "Get the status of an Azure Pipelines build by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" } },
      required: ["id"],
    },
    dispatch: (c: AdoClient, a: unknown) =>
      c.getBuildStatus(a as Parameters<AdoClient["getBuildStatus"]>[0]),
  },
] as const;

export function createServer(client?: AdoClient): Server {
  const resolvedClient = client ?? createAdoClient(loadConfigFromEnv());

  const server = new Server(
    { name: "avia-azure-devops", version: "0.0.0" },
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
                code: "ado_error",
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
