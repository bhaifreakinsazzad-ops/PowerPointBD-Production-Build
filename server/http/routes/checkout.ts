import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { asyncRoute, ApiError } from '../errors.ts';
import { withUserContext, webhookPool } from '../db.ts';
import { rejectForbiddenClientFields, requireString } from '../validation.ts';
import { env } from '../env.ts';
import { commercePolicy } from '../commerce-policy.ts';
import { paidProductionInput } from '../production-entitlement.ts';

export function createCheckoutRouter(
  context = withUserContext,
  policy = () => commercePolicy(env.NODE_ENV),
  webhookDb: Pool = webhookPool,
) {
  const checkoutRouter = Router();
  checkoutRouter.get('/projects/:id/order',asyncRoute(async(req,res)=>{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id??''))throw new ApiError(400,'INVALID_PROJECT_ID','A valid project ID is required.');
    const data=await context(req.user!.id,async(db)=>{
      const project=(await db.query('SELECT id,title,state FROM ai_presentation.projects WHERE id=$1 AND owner_id=$2',[req.params.id,req.user!.id])).rows[0];
      if(!project)throw new ApiError(404,'PROJECT_NOT_FOUND','Project not found.');
      const quote=(await db.query(`SELECT id,tier,slide_count,quote_amount,quote_amount_paisa,quote_breakdown,expires_at,status,
        expires_at>clock_timestamp() AS not_expired FROM ai_presentation.quotes WHERE project_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,[project.id])).rows[0]??null;
      const payment=quote?(await db.query('SELECT status,provider,currency FROM ai_presentation.payments WHERE quote_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[quote.id])).rows[0]??null:null;
      const job=(await db.query(`SELECT id,status,progress_stage,error_code,attempts,output_asset_id,validation_report,design_spec_id,entitlement_id
        FROM ai_presentation.jobs WHERE project_id=$1 AND job_type='pptx_production' ORDER BY created_at DESC,id DESC LIMIT 1`,[project.id])).rows[0];
      const entitlement=(await db.query("SELECT id,design_spec_id FROM ai_presentation.entitlements WHERE project_id=$1 AND status='active' ORDER BY granted_at DESC,id DESC LIMIT 1",[project.id])).rows[0];
      const valid=!!entitlement&&!!await paidProductionInput(db,{projectId:project.id,specId:entitlement.design_spec_id,entitlementId:entitlement.id,ownerId:req.user!.id});
      const delivered=job?.status==='completed'?job:(await db.query(`SELECT output_asset_id,validation_report,design_spec_id,entitlement_id FROM ai_presentation.jobs
        WHERE project_id=$1 AND job_type='pptx_production' AND status='completed' ORDER BY created_at DESC,id DESC LIMIT 1`,[project.id])).rows[0];
      const asset=delivered?.output_asset_id?(await db.query('SELECT id FROM ai_presentation.generated_assets WHERE id=$1 AND owner_id=$2 AND NOT is_quarantined',[delivered.output_asset_id,req.user!.id])).rowCount:0;
      const downloadable=valid&&delivered?.validation_report?.passed===true&&!!asset&&delivered.design_spec_id===entitlement?.design_spec_id&&delivered.entitlement_id===entitlement?.id;
      return {project,quote:quote?{...quote,quote_amount_paisa:Number(quote.quote_amount_paisa)}:null,payment,
        production:job?{id:job.id,status:job.status,progress_stage:job.progress_stage,error_code:job.error_code,attempts:job.attempts}:null,
        can_produce:valid&&!['queued','running','failed','validating'].includes(job?.status)&&!downloadable,
        download_available:downloadable,
        commerce:policy()};
    });
    res.setHeader('Cache-Control','no-store');res.json({ok:true,data});
  }));

  // ============================================================================
  // POST /checkout/session
  // ============================================================================
  checkoutRouter.post(
    '/checkout/session',
    asyncRoute(async (req, res) => {
      if(!policy().sandbox_available)throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Checkout is unavailable until a real payment provider is configured and verified.');
      const body = rejectForbiddenClientFields(req.body);
      const quoteId = requireString(body, 'quote_id', { minLength: 1 });
      const idempotencyKey = requireString(body, 'idempotency_key', { minLength: 6, maxLength: 128 });

      const result = await context(req.user!.id, async (client) => {
        const quoteRef = (await client.query('SELECT project_id FROM ai_presentation.quotes WHERE id = $1', [quoteId])).rows[0];
        if (!quoteRef) throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Quote not found.');
        const project = (await client.query('SELECT * FROM ai_presentation.projects WHERE id = $1 FOR UPDATE', [quoteRef.project_id])).rows[0];
        if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
        const quoteResult = await client.query('SELECT *, expires_at > clock_timestamp() AS not_expired FROM ai_presentation.quotes WHERE id = $1 FOR UPDATE', [quoteId]);
        const quote = quoteResult.rows[0];
        if (!quote) throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Quote not found.');

        const existing = await client.query(
          'SELECT * FROM ai_presentation.payments WHERE quote_id = $1 AND idempotency_key = $2',
          [quoteId, idempotencyKey]
        );
        if (existing.rows.length > 0) return { payment: existing.rows[0], idempotent_replay: true };
        if (['paid','production_queued','producing','validating','delivered','cancelled'].includes(project.state)) {
          throw new ApiError(409, 'PROJECT_NOT_PAYABLE', 'This project cannot start another checkout.');
        }
        if (quote.status !== 'active') {
          throw new ApiError(409, 'QUOTE_NOT_ACTIVE', `Quote status is '${quote.status}', not 'active'.`);
        }
        if (!quote.not_expired) {
          throw new ApiError(409, 'QUOTE_EXPIRED', 'This quote has expired. Create a fresh quote before checking out.');
        }

        const pending = await client.query(
          "SELECT * FROM ai_presentation.payments WHERE quote_id = $1 AND status = 'pending' ORDER BY created_at LIMIT 1",
          [quoteId]
        );
        if (pending.rows.length > 0) return { payment: pending.rows[0], idempotent_replay: true };

        const providerSessionId = `mock_sess_${randomBytes(16).toString('hex')}`;
        const inserted = await client.query(
          `INSERT INTO ai_presentation.payments
             (project_id, owner_id, quote_id, provider, provider_session_id, idempotency_key,
              tier, quote_amount, quote_amount_paisa, quote_breakdown, currency, status)
           VALUES ($1, $2, $3, 'mock_sandbox', $4, $5, $6, $7, $8, $9, 'BDT', 'pending')
           ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
          [
            quote.project_id,
            req.user!.id,
            quoteId,
            providerSessionId,
            idempotencyKey,
            quote.tier,
            quote.quote_amount,
            quote.quote_amount_paisa,
            quote.quote_breakdown,
          ]
        );
        if (!inserted.rows[0]) throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Use a different key for this checkout.');
        await client.query("UPDATE ai_presentation.projects SET state = 'payment_pending', updated_at = NOW() WHERE id = $1", [
          quote.project_id,
        ]);

        return { payment: inserted.rows[0], idempotent_replay: false };
      });

      res.status(result.idempotent_replay ? 200 : 201).json({
        ok: true,
        data: {
          payment: result.payment,
          checkout_mode: 'sandbox_no_real_provider',
        },
      });
    })
  );

  // ============================================================================
  // POST /checkout/confirm
  // Submits payment verification request for Bangla QR (bKash / Nagad / banks).
  // Security P0:
  // - investor_demo is blocked in production (returns 403)
  // - duplicate TrxID (reference) is blocked (returns 409)
  // - sets status to 'pending_verification' (NEVER auto-verified)
  // ============================================================================
  checkoutRouter.post(
    '/checkout/confirm',
    asyncRoute(async (req, res) => {
      const body = rejectForbiddenClientFields(req.body);
      const quoteId = requireString(body, 'quote_id', { minLength: 1 });
      const paymentMethod = requireString(body, 'payment_method', { minLength: 1, maxLength: 32 });
      const reference = requireString(body, 'reference', { minLength: 1, maxLength: 128 });
      const idempotencyKey = requireString(body, 'idempotency_key', { minLength: 6, maxLength: 128 });

      // P0 Security Fix: Block investor_demo in production
      if (paymentMethod === 'investor_demo') {
        if (env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_PAYMENT !== 'true') {
          throw new ApiError(403, 'FORBIDDEN_PAYMENT_METHOD', 'Investor demo payment method is strictly forbidden in production.');
        }
      }

      const cleanReference = reference.trim();

      // 1. User context: Check quote/project ownership and insert pending payment
      const userStep = await context(req.user!.id, async (client) => {
        const quoteRef = (await client.query('SELECT project_id FROM ai_presentation.quotes WHERE id = $1', [quoteId])).rows[0];
        if (!quoteRef) throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Quote not found.');
        const project = (await client.query('SELECT * FROM ai_presentation.projects WHERE id = $1 FOR UPDATE', [quoteRef.project_id])).rows[0];
        if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
        const quoteResult = await client.query('SELECT *, expires_at > clock_timestamp() AS not_expired FROM ai_presentation.quotes WHERE id = $1 FOR UPDATE', [quoteId]);
        const quote = quoteResult.rows[0];
        if (!quote) throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Quote not found.');

        // P0 Security Fix: Check for duplicate TrxID reference across all payments
        const dupCheck = await client.query(
          'SELECT id FROM ai_presentation.payments WHERE (provider_txn_id = $1 OR reference = $1) AND quote_id <> $2',
          [cleanReference, quoteId]
        );
        if (dupCheck.rows.length > 0) {
          throw new ApiError(409, 'DUPLICATE_TRANSACTION_ID', 'This Transaction ID (TrxID) has already been submitted. Please check your SMS or enter a valid TrxID.');
        }

        const existing = await client.query(
          'SELECT * FROM ai_presentation.payments WHERE quote_id = $1 AND idempotency_key = $2',
          [quoteId, idempotencyKey]
        );
        if (existing.rows.length > 0 && existing.rows[0].status === 'verified') {
          return { payment: existing.rows[0], idempotent_replay: true, quote, project };
        }

        if (project.state === 'cancelled') {
          throw new ApiError(409, 'PROJECT_NOT_PAYABLE', 'This project cannot be paid.');
        }
        if (quote.status === 'paid') {
          const paidPayment = (await client.query("SELECT * FROM ai_presentation.payments WHERE quote_id = $1 AND status = 'verified' LIMIT 1", [quoteId])).rows[0];
          if (paidPayment) return { payment: paidPayment, idempotent_replay: true, quote, project };
          throw new ApiError(409, 'QUOTE_ALREADY_PAID', 'This quote is already paid.');
        }
        if (quote.status !== 'active') {
          throw new ApiError(409, 'QUOTE_NOT_ACTIVE', `Quote status is '${quote.status}', not 'active'.`);
        }
        if (!quote.not_expired) {
          throw new ApiError(409, 'QUOTE_EXPIRED', 'This quote has expired. Create a fresh quote before checking out.');
        }

        let payment = existing.rows[0];
        if (!payment) {
          const providerSessionId = `sess_${paymentMethod}_${randomBytes(12).toString('hex')}`;
          const inserted = await client.query(
            `INSERT INTO ai_presentation.payments
               (project_id, owner_id, quote_id, provider, provider_session_id, idempotency_key,
                tier, quote_amount, quote_amount_paisa, quote_breakdown, currency, status, reference, provider_txn_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'BDT', 'pending_verification', $11, $11)
             ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
            [
              quote.project_id,
              req.user!.id,
              quoteId,
              paymentMethod,
              providerSessionId,
              idempotencyKey,
              quote.tier,
              quote.quote_amount,
              quote.quote_amount_paisa,
              quote.quote_breakdown,
              cleanReference,
            ]
          );
          payment = inserted.rows[0] ?? (await client.query('SELECT * FROM ai_presentation.payments WHERE idempotency_key = $1', [idempotencyKey])).rows[0];
        } else {
          // Update reference if existing pending
          await client.query(
            `UPDATE ai_presentation.payments SET reference = $1, provider_txn_id = $1, status = 'pending_verification', updated_at = NOW() WHERE id = $2`,
            [cleanReference, payment.id]
          );
          payment.reference = cleanReference;
          payment.status = 'pending_verification';
        }

        await client.query("UPDATE ai_presentation.projects SET state = 'payment_pending', updated_at = NOW() WHERE id = $1", [quote.project_id]);

        return { payment, idempotent_replay: false, quote, project };
      });

      if (userStep.idempotent_replay) {
        res.status(200).json({ ok: true, data: { payment: userStep.payment, status: userStep.payment.status } });
        return;
      }

      // P0 Security Fix: Return pending_verification ("যাচাই চলছে"). NEVER auto-verify!
      res.status(202).json({
        ok: true,
        data: {
          payment: userStep.payment,
          status: 'pending_verification',
          message: 'পেমেন্ট যাচাই চলছে। অ্যাডমিন যাচাই শেষে আপনার পুরো ডেক প্রস্তুত হবে (সাধারণত ১০-৩০ মিনিট)।',
        },
      });
    })
  );

  return checkoutRouter;
}
export const checkoutRouter = createCheckoutRouter();
