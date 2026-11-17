// Loading env.ts loads the ignored local .env.local file in development.
import './env.ts';

export function integrationFixtureUser(slot: 'A' | 'B'): { email: string; password: string } {
  const suffix = slot === 'A' ? 'A' : 'B';
  const email = process.env[`INTEGRATION_TEST_USER_${suffix}_EMAIL`]?.trim();
  const password = process.env[`INTEGRATION_TEST_USER_${suffix}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`Integration fixture credentials are missing. Set INTEGRATION_TEST_USER_${suffix}_EMAIL and INTEGRATION_TEST_USER_${suffix}_PASSWORD in the ignored local environment.`);
  }
  return { email, password };
}
