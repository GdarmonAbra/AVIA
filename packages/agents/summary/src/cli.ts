import path from "node:path";
import { inMemoryRegistry, loadMcpConfig, type AgentToolDef } from "@avia/agents-shared";
import { runSummaryAgent } from "./index.js";

/**
 * Usage:
 *   pnpm --filter @avia/agents-summary start -- --work-item=mock:1   # mocked tool, no tenant
 *   pnpm --filter @avia/agents-summary start -- --work-item=1234     # hits the real azure-devops MCP
 *
 * With `--work-item=mock:<id>` a fake azure-devops server is registered in
 * memory so the Claude harness + prompt caching can be exercised without a
 * real Entra login.
 */
async function main(): Promise<void> {
  const arg = process.argv.find((a) => a.startsWith("--work-item="));
  if (!arg) {
    console.error("Usage: --work-item=mock:<id> | <adoId>");
    process.exit(1);
  }
  const [, value] = arg.split("=", 2);
  if (!value) {
    console.error("Missing --work-item value.");
    process.exit(1);
  }

  const mock = value.startsWith("mock:");
  const workItemId = mock ? value.slice("mock:".length) : Number(value);

  let tools: AgentToolDef[];
  let close: () => Promise<void> = async () => {};

  if (mock) {
    tools = [mockAdoTool(workItemId)];
  } else {
    const configPath = path.resolve(
      process.env["AVIA_MCP_CONFIG"] ?? "mcp-clients/mcp.json",
    );
    const registry = await loadMcpConfig(configPath);
    tools = await registry.tools("azure-devops");
    close = () => registry.closeAll();
  }

  try {
    const out = await runSummaryAgent({ workItemId }, { tools });
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await close();
  }
}

function mockAdoTool(workItemId: string | number): AgentToolDef {
  return {
    name: "azure-devops__ado_get_work_item",
    description: "Fetch an Azure DevOps work item by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: ["string", "number"] } },
      required: ["id"],
    },
    handler: async () => ({
      workItem: {
        id: workItemId,
        type: "Bug",
        state: "Active",
        title: "Block sales orders for non-compliant customers",
        description:
          "When a customer lacks a valid compliance certification, the system must prevent sales order creation and surface a clear error to the user.",
        acceptanceCriteria:
          "- Creation is blocked with an error message.\n- Admins can still override with reason.",
      },
    }),
  };
}

// Allow the module to be imported without running main().
void inMemoryRegistry;

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
