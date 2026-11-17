/** Explicit opt-in because these suites modify pricing, fixtures and private storage. */
export function assertIntegrationTarget(config: { SUPABASE_URL: string; DATABASE_URL: string;
  WEBHOOK_DATABASE_URL: string; WORKER_DATABASE_URL: string }, variables = process.env): void {
  if (variables.ALLOW_REMOTE_INTEGRATION_TESTS !== '1'
      || variables.INTEGRATION_TEST_SUPABASE_URL !== config.SUPABASE_URL) {
    throw new Error('Remote integration tests are disabled. Use an authorized isolated target and explicitly set ALLOW_REMOTE_INTEGRATION_TESTS=1 and INTEGRATION_TEST_SUPABASE_URL to its exact URL. These tests modify data and pricing.');
  }
  for (const value of [config.DATABASE_URL, config.WEBHOOK_DATABASE_URL, config.WORKER_DATABASE_URL]) {
    if (new URL(value).hostname !== variables.INTEGRATION_TEST_DATABASE_HOST) {
      throw new Error('Integration database host differs from INTEGRATION_TEST_DATABASE_HOST; refusing test mutations.');
    }
  }
}
