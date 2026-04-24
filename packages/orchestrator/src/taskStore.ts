import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TaskState } from "@avia/shared-types";

export interface TaskStore {
  load(id: string): Promise<TaskState | null>;
  save(state: TaskState): Promise<void>;
  list(): Promise<string[]>;
}

export class FileTaskStore implements TaskStore {
  constructor(private readonly root: string = ".avia/tasks") {}

  private pathFor(id: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new Error(`Invalid task id: ${id}`);
    }
    return path.join(this.root, `${id}.json`);
  }

  async load(id: string): Promise<TaskState | null> {
    try {
      const raw = await readFile(this.pathFor(id), "utf8");
      return TaskState.parse(JSON.parse(raw));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async save(state: TaskState): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.pathFor(state.id), JSON.stringify(state, null, 2), "utf8");
  }

  async list(): Promise<string[]> {
    try {
      const entries = await readdir(this.root);
      return entries
        .filter((e) => e.endsWith(".json"))
        .map((e) => e.replace(/\.json$/, ""));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}
