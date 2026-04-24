import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { AgentToolDef } from "./harness.js";

export type StdioServerConfig = {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type StreamableHttpServerConfig = {
  type: "streamable-http";
  url: string;
  headers?: Record<string, string>;
  auth?: {
    type: "oauth-client-credentials";
    tenantId: string;
    clientId: string;
    clientSecret: string;
    resource: string;
  };
};

export type McpServerConfig = StdioServerConfig | StreamableHttpServerConfig;

export interface McpConfigFile {
  mcpServers: Record<string, McpServerConfig & Record<string, unknown>>;
}

export interface ConnectedServer {
  name: string;
  client: Client;
  close(): Promise<void>;
}

/**
 * Connects to a single MCP server described by `config` and returns a handle.
 * HTTP servers that require client-credentials get a bearer token minted via
 * Entra before the transport is opened; that token is only refreshed when the
 * caller reconnects.
 */
export async function connectServer(
  name: string,
  config: McpServerConfig,
): Promise<ConnectedServer> {
  const client = new Client(
    { name: "avia", version: "0.0.0" },
    { capabilities: {} },
  );

  if (config.type === "stdio") {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: {
        ...(process.env as Record<string, string>),
        ...(config.env ?? {}),
      },
    });
    await client.connect(transport);
  } else {
    const headers = { ...(config.headers ?? {}) };
    if (config.auth?.type === "oauth-client-credentials") {
      const token = await fetchClientCredentialsToken(config.auth);
      headers["Authorization"] = `Bearer ${token}`;
    }
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: { headers },
    });
    await client.connect(transport as unknown as Transport);
  }

  return {
    name,
    client,
    close: async () => {
      await client.close();
    },
  };
}

async function fetchClientCredentialsToken(auth: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  resource: string;
}): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
    resource: auth.resource,
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${auth.tenantId}/oauth2/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(
      `Entra token request failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Entra token response missing access_token");
  }
  return json.access_token;
}

/**
 * Lists tools from an MCP server and adapts them into the `AgentToolDef` shape
 * the Claude tool-use harness expects. Tool names are namespaced as
 * `${server}__${tool}` so multiple servers can be combined without collision.
 */
export async function listServerTools(
  server: ConnectedServer,
): Promise<AgentToolDef[]> {
  const { tools } = await server.client.listTools();
  return tools.map((t) =>
    adaptTool(server, {
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }),
  );
}

interface ListedTool {
  name: string;
  description: string | undefined;
  inputSchema: Record<string, unknown>;
}

function adaptTool(server: ConnectedServer, t: ListedTool): AgentToolDef {
  const namespaced = `${server.name}__${t.name}`;
  if (namespaced.length > 64) {
    // Anthropic tool_use names cap at 64 chars — truncate deterministically.
    throw new Error(
      `Namespaced tool name too long (>64 chars): ${namespaced}. Shorten the server name in mcp.json.`,
    );
  }
  return {
    name: namespaced,
    description: t.description ?? `${server.name}.${t.name}`,
    inputSchema: t.inputSchema,
    handler: async (input) => {
      const result = await server.client.callTool({
        name: t.name,
        arguments: input as Record<string, unknown>,
      });
      if (result.isError) {
        return {
          error: {
            code: "mcp_tool_error",
            message: flattenContent(result.content),
          },
        };
      }
      return parseContent(result.content);
    },
  };
}

function flattenContent(content: unknown): string {
  if (!Array.isArray(content)) return String(content);
  return content
    .map((c) => (typeof c === "object" && c && "text" in c ? String((c as { text: unknown }).text) : ""))
    .join("");
}

function parseContent(content: unknown): unknown {
  const text = flattenContent(content);
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}
