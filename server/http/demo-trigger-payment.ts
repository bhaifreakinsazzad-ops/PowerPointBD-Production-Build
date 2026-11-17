/**
 * Simulates the payment provider calling our webhook — for the live browser
 * demo (frontend/public/live-demo.html) only. A real provider would do this
 * itself after the customer completes payment on its hosted checkout page;
 * since no real provider is connected (docs/BLOCKERS.md #2), this stands in
 * for that server-to-server call, signed with the same real secret the
 * actual /webhooks/mock_sandbox route verifies.
 *
 * Usage: npm run demo:pay -- <provider_session_id> <quote_amount_bdt>
 */
import { createHmac, randomUUID } from 'node:crypto';
import { env } from './env.ts';

const [providerSessionId, amountStr] = process.argv.slice(2);
if (!providerSessionId || !amountStr) {
  console.error('Usage: npm run demo:pay -- <provider_session_id> <quote_amount_bdt>');
  process.exit(1);
}

const payload = JSON.stringify({
  event_id: randomUUID(),
  provider_session_id: providerSessionId,
  status: 'VALID',
  amount_bdt: Number(amountStr),
  currency: 'BDT',
});
const signature = createHmac('sha256', env.MOCK_PAYMENT_WEBHOOK_SECRET).update(payload).digest('hex');

const res = await fetch('http://localhost:8787/webhooks/mock_sandbox', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Mock-Signature': signature },
  body: payload,
});
const body = await res.json();
console.log(res.status, JSON.stringify(body, null, 2));
