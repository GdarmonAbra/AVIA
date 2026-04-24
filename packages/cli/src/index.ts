#!/usr/bin/env node
import { parseArgs } from "node:util";

import { defaultDeps, run, type StopAfter } from "./runner.js";

function usage(): string {
  return `
avia — run the AVIA agent pipeline for a Dynamics 365 F&O work item.

Usage:
  avia --work-item <id> [options]

Options:
  --work-item <id>         Azure DevOps work item id (required)
  --task-id <id>           Task id for persistence (default: task_<workItemId>)
  --mcp-config <path>      Path to mcp.json (default: ./mcp-clients/mcp.json)
  --task-dir <path>        Where to persist TaskState (default: ./.avia/tasks)
  --stop-after <stage>     summary | design | dev | test
                           Stops the pipeline after the named stage.
  --auto-approve           Skip the DesignProposal y/N prompt.
  -h, --help               Print this help and exit.

Environment:
  ANTHROPIC_API_KEY        Required for Claude agent calls.
  MCP_D365FO_NAV_PATH      Path to the built d365fo-mcp-server.
  AVIA_D365_METADATA_PATH  Path to PackagesLocalDirectory.
  (additional vars per mcp.json — see docs/running.md)
`.trim();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "work-item": { type: "string" },
      "task-id": { type: "string" },
      "mcp-config": { type: "string", default: "./mcp-clients/mcp.json" },
      "task-dir": { type: "string", default: "./.avia/tasks" },
      "stop-after": { type: "string" },
      "auto-approve": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const workItem = values["work-item"];
  if (!workItem) {
    console.error("error: --work-item is required\n");
    console.error(usage());
    process.exit(2);
  }

  const stopAfter = values["stop-after"] as StopAfter | undefined;
  if (stopAfter && !["summary", "design", "dev", "test"].includes(stopAfter)) {
    console.error(`error: invalid --stop-after value: ${stopAfter}`);
    process.exit(2);
  }

  const deps = await defaultDeps({
    mcpConfigPath: values["mcp-config"] as string,
    taskDir: values["task-dir"] as string,
  });

  try {
    const opts = {
      workItemId: workItem,
      ...(values["task-id"] ? { taskId: values["task-id"] as string } : {}),
      ...(stopAfter ? { stopAfter } : {}),
      ...(values["auto-approve"] ? { autoApprove: true } : {}),
    };
    const { final, stoppedEarly } = await run(opts, deps);
    console.log(
      `\nfinal status: ${final.status}${stoppedEarly ? " (stopped early)" : ""}`,
    );
    if (final.status === "failed" || final.status === "aborted") {
      process.exit(1);
    }
  } finally {
    await deps.registry.closeAll();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
