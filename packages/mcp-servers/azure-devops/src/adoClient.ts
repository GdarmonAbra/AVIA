export class NotImplementedError extends Error {
  constructor(marker: string) {
    super(`Not implemented: ${marker}`);
    this.name = "NotImplementedError";
  }
}

export interface AdoConfig {
  orgUrl: string;
  project: string;
  pat: string;
}

export interface AdoClient {
  getWorkItem(args: { id: number | string }): Promise<{
    workItem: {
      id: number | string;
      title: string;
      description: string;
      state: string;
      type: string;
      acceptanceCriteria?: string;
      fields: Record<string, unknown>;
    };
  }>;
  updateWorkItem(args: {
    id: number | string;
    patch: Array<{ op: "add" | "replace"; path: string; value: unknown }>;
  }): Promise<{ workItem: { id: number | string; rev: number } }>;
  createPullRequest(args: {
    repo: string;
    source: string;
    target: string;
    title: string;
    body: string;
  }): Promise<{ pullRequest: { id: number; url: string } }>;
  getBuildStatus(args: { id: number }): Promise<{
    build: { id: number; status: string; result: string };
  }>;
}

export function loadConfigFromEnv(): AdoConfig {
  const req = (k: string): string => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} is not set`);
    return v;
  };
  return {
    orgUrl: req("ADO_ORG_URL"),
    project: req("ADO_PROJECT"),
    pat: req("ADO_PAT"),
  };
}

/**
 * Real implementation lands in AVIA-003. Until then these stubs preserve the
 * shape so agents can be wired and tested with mocks.
 */
export function createAdoClient(_config: AdoConfig): AdoClient {
  const na = (verb: string) => {
    throw new NotImplementedError(`avia-003: ado ${verb}`);
  };
  return {
    getWorkItem: async () => na("getWorkItem"),
    updateWorkItem: async () => na("updateWorkItem"),
    createPullRequest: async () => na("createPullRequest"),
    getBuildStatus: async () => na("getBuildStatus"),
  };
}
