import { readFile } from "node:fs/promises";
import { NotImplementedError } from "./errors.js";
import {
  connectServer,
  listServerTools,
  type ConnectedServer,
  type McpConfigFile,
  type McpServerConfig,
} from "./mcpClient.js";
import type { AgentToolDef } from "./harness.js";

/**
 * In-memory view of an `mcp.json` file. Each server is connected lazily on
 * first `tools(name)` call. The caller owns lifecycle — call `closeAll()`
 * before the process exits.
 */
export class McpRegistry {
  private readonly configs: Record<string, McpServerConfig>;
  private readonly connections = new Map<string, Promise<ConnectedServer>>();
  private readonly toolCache = new Map<string, AgentToolDef[]>();

  constructor(configs: Record<string, McpServerConfig>) {
    this.configs = configs;
  }

  /** Tool defs for a single named server, adapted to the Claude harness shape. */
  async tools(name: string): Promise<AgentToolDef[]> {
    const cached = this.toolCache.get(name);
    if (cached) return cached;
    const server = await this.ensureConnected(name);
    const tools = await listServerTools(server);
    this.toolCache.set(name, tools);
    return tools;
  }

  /** Concatenated tool defs across multiple servers. */
  async toolsFor(...names: string[]): Promise<AgentToolDef[]> {
    const all = await Promise.all(names.map((n) => this.tools(n)));
    return all.flat();
  }

  async closeAll(): Promise<void> {
    const servers = await Promise.all(this.connections.values());
    await Promise.all(servers.map((s) => s.close()));
    this.connections.clear();
    this.toolCache.clear();
  }

  private async ensureConnected(name: string): Promise<ConnectedServer> {
    const existing = this.connections.get(name);
    if (existing) return existing;
    const config = this.configs[name];
    if (!config) {
      throw new Error(
        `MCP server '${name}' is not configured in mcp.json. Known: ${Object.keys(this.configs).join(", ")}`,
      );
    }
    const pending = connectServer(name, config);
    this.connections.set(name, pending);
    return pending;
  }
}

/**
 * Loads an mcp.json file and expands `${VAR}` placeholders against
 * `process.env`. Keys prefixed with `_` (comments, documentation) are dropped.
 */
export async function loadMcpConfig(path: string): Promise<McpRegistry> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as McpConfigFile;
  const servers: Record<string, McpServerConfig> = {};
  for (const [name, rawConfig] of Object.entries(parsed.mcpServers)) {
    servers[name] = cleanAndExpand(rawConfig) as McpServerConfig;
  }
  return new McpRegistry(servers);
}

function cleanAndExpand(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanAndExpand);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith("_")) continue; // drop doc-only keys
      out[k] = cleanAndExpand(v);
    }
    return out;
  }
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, varName: string) => {
      return process.env[varName] ?? "";
    });
  }
  return value;
}

/**
 * Convenience for tests and for the summary-agent CLI mock: build a registry
 * from a plain object without touching the filesystem.
 */
export function inMemoryRegistry(
  configs: Record<string, McpServerConfig>,
): McpRegistry {
  return new McpRegistry(configs);
}

export { NotImplementedError };
