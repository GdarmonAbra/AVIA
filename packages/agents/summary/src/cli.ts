import { NotImplementedError, type AgentToolDef } from "@avia/agents-shared";
import { runSummaryAgent } from "./index.js";

/**
 * Thin CLI wrapper for the smoke test in the verification section of the plan.
 * Usage: `pnpm --filter @avia/agents-summary start --work-item=mock:1`
 *
 * With `--work-item=mock:<id>` the ADO tool is stubbed in-process so the harness
 * can exercise Claude without a real Azure DevOps PAT.
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

  const adoGetWorkItem: AgentToolDef = {
    name: "ado_get_work_item",
    description: "Fetch an Azure DevOps work item by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: ["string", "number"] } },
      required: ["id"],
    },
    handler: async () => {
      if (mock) {
        return {
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
        };
      }
      throw new NotImplementedError("avia-001: real ado_get_work_item");
    },
  };

  const out = await runSummaryAgent({ workItemId }, { adoGetWorkItem });
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
