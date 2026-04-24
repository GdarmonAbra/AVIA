import * as vscode from "vscode";
import { FileTaskStore } from "@avia/orchestrator";

/**
 * VS Code "cockpit" entry point. Registers the two user-facing commands and
 * wires them to the orchestrator. Agent dispatch + MCP plumbing is in
 * packages/orchestrator (and the agents themselves); this file is just the
 * UI shell.
 *
 * Real implementation lands in AVIA-004 — this scaffold is enough to package
 * and sideload the extension so the team can validate the command palette
 * registration.
 */
export function activate(context: vscode.ExtensionContext): void {
  const store = new FileTaskStore();

  context.subscriptions.push(
    vscode.commands.registerCommand("avia.runOnWorkItem", async () => {
      const id = await vscode.window.showInputBox({
        prompt: "Azure DevOps work item id",
        placeHolder: "1234",
      });
      if (!id) return;
      await vscode.window.showInformationMessage(
        `AVIA: would start task for work item ${id}. (TODO avia-004: wire orchestrator runner.)`,
      );
    }),

    vscode.commands.registerCommand("avia.resumeTask", async () => {
      const ids = await store.list();
      if (ids.length === 0) {
        await vscode.window.showInformationMessage(
          "AVIA: no tasks found under .avia/tasks.",
        );
        return;
      }
      const picked = await vscode.window.showQuickPick(ids, {
        placeHolder: "Select a task to resume",
      });
      if (!picked) return;
      await vscode.window.showInformationMessage(
        `AVIA: would resume task ${picked}. (TODO avia-004: wire orchestrator runner.)`,
      );
    }),
  );
}

export function deactivate(): void {
  // nothing to clean up yet
}
