import { NotImplementedError } from "./errors.js";

export interface OdataConfig {
  baseUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  resource: string;
}

export interface OdataClient {
  query(args: {
    entity: string;
    filter?: string;
    select?: string[];
    top?: number;
  }): Promise<{ value: Record<string, unknown>[] }>;
  create(args: {
    entity: string;
    payload: Record<string, unknown>;
  }): Promise<{ record: Record<string, unknown> }>;
  update(args: {
    entity: string;
    key: Record<string, unknown>;
    patch: Record<string, unknown>;
  }): Promise<{ record: Record<string, unknown> }>;
  invokeAction(args: {
    action: string;
    payload?: Record<string, unknown>;
  }): Promise<{ result: unknown }>;
  readFormState(args: {
    form: string;
    args?: Record<string, unknown>;
  }): Promise<{ fields: Record<string, unknown>; validations: string[] }>;
}

export function loadConfigFromEnv(): OdataConfig {
  const req = (k: string): string => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} is not set`);
    return v;
  };
  return {
    baseUrl: req("D365_BASE_URL"),
    tenantId: req("D365_TENANT_ID"),
    clientId: req("D365_CLIENT_ID"),
    clientSecret: req("D365_CLIENT_SECRET"),
    resource: process.env["D365_RESOURCE"] ?? req("D365_BASE_URL"),
  };
}

/**
 * Real HTTP implementation. Stubbed in this scaffold — fills in during the
 * follow-up PR (AVIA-002). The production path:
 *   1. POST https://login.microsoftonline.com/{tenantId}/oauth2/token
 *      grant_type=client_credentials, resource={resource}
 *   2. Apply the bearer token to /data/{entity} calls on baseUrl.
 */
export function createOdataClient(_config: OdataConfig): OdataClient {
  const na = (verb: string) => {
    throw new NotImplementedError(`avia-002: odata ${verb}`);
  };
  return {
    query: async () => na("query"),
    create: async () => na("create"),
    update: async () => na("update"),
    invokeAction: async () => na("invokeAction"),
    readFormState: async () => na("readFormState"),
  };
}
