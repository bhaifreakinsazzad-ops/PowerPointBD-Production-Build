import { Router } from 'express';
import { asyncRoute, ApiError } from '../errors.ts';
import { webhookPool } from '../db.ts';
import { env } from '../env.ts';
import { createSandboxPaymentService } from '../payment-service.ts';
import { commercePolicy } from '../commerce-policy.ts';

export function createWebhooksRouter(
  processWebhook = createSandboxPaymentService(webhookPool, env.MOCK_PAYMENT_WEBHOOK_SECRET),
  policy=()=>commercePolicy(env.NODE_ENV),
) {
  const router = Router();
  router.post('/webhooks/:provider', asyncRoute(async (req, res) => {
    if(!policy().sandbox_available)throw new ApiError(404,'UNKNOWN_PROVIDER','This payment provider is not configured.');
    if (req.params.provider !== 'mock_sandbox') {
      throw new ApiError(404, 'UNKNOWN_PROVIDER', 'This payment provider is not configured.');
    }
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    const signature = req.header('x-mock-signature');
    if (!raw || !signature) throw new ApiError(401, 'MISSING_SIGNATURE', 'A signed raw webhook body is required.');
    const result = await processWebhook(raw, signature);
    res.status(result.status).json(result.body);
  }));
  return router;
}
export const webhooksRouter = createWebhooksRouter();
