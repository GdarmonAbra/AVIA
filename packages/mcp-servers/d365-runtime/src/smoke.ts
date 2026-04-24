import { createOdataClient, loadConfigFromEnv } from "./odataClient.js";

/**
 * Verification step #5: hit the live F&O environment with one OData GET and
 * print the row count. This exercises auth + networking without touching
 * business data. Real implementation lands in AVIA-002; until then this
 * throws a NotImplementedError with a clear marker.
 */
async function main(): Promise<void> {
  const client = createOdataClient(loadConfigFromEnv());
  const res = await client.query({ entity: "SalesOrderHeadersV2", top: 1 });
  console.log(
    JSON.stringify({ ok: true, count: res.value.length, sample: res.value[0] }, null, 2),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
