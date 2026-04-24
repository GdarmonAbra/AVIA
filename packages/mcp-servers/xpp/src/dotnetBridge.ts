import { spawn } from "node:child_process";

/**
 * Shells out to the .NET CLI (`dotnet <AVIA_XPP_CLI_PATH> <verb> --json <payload>`)
 * and parses JSON from stdout. The CLI is expected to always write a single
 * JSON object to stdout; stderr is captured into the error message on failure.
 */
export interface DotnetBridgeOptions {
  cliPath?: string;
}

export class DotnetBridge {
  constructor(private readonly opts: DotnetBridgeOptions = {}) {}

  async invoke(verb: string, payload: unknown): Promise<unknown> {
    const cliPath =
      this.opts.cliPath ??
      process.env["AVIA_XPP_CLI_PATH"] ??
      "src/Avia.Xpp.Cli/bin/Release/net8.0/Avia.Xpp.Cli.dll";

    return new Promise((resolve, reject) => {
      const proc = spawn(
        "dotnet",
        [cliPath, verb, "--json", JSON.stringify(payload)],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (chunk) => (stdout += String(chunk)));
      proc.stderr.on("data", (chunk) => (stderr += String(chunk)));

      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `avia-xpp ${verb} exited with code ${code}. stderr:\n${stderr.trim()}`,
            ),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (err) {
          reject(
            new Error(
              `avia-xpp ${verb} returned invalid JSON: ${
                (err as Error).message
              }\nstdout:\n${stdout}`,
            ),
          );
        }
      });
    });
  }
}
