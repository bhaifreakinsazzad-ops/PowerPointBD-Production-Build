import { Router } from 'express';
import { asyncRoute, ApiError } from '../errors.ts';
import { withUserContext } from '../db.ts';
import { rejectForbiddenClientFields, requireString } from '../validation.ts';
import { createSignedDownloadUrl } from '../storage.ts';
import { paidProductionInput } from '../production-entitlement.ts';

export function createProduceRouter(dependencies: {
  withUserContext: typeof withUserContext;
  createSignedDownloadUrl: typeof createSignedDownloadUrl;
} = { withUserContext, createSignedDownloadUrl }) {
  const { withUserContext, createSignedDownloadUrl } = dependencies;
  const produceRouter = Router();

  // ============================================================================
  // POST /projects/:id/produce
  // ============================================================================
  produceRouter.post(
    '/projects/:id/produce',
    asyncRoute(async (req, res) => {
      const body = rejectForbiddenClientFields(req.body);
      const idempotencyKey = requireString(body, 'idempotency_key', { minLength: 6, maxLength: 128 });

      const result = await withUserContext(req.user!.id, async (client) => {
        const projectResult = await client.query('SELECT * FROM ai_presentation.projects WHERE id = $1 FOR UPDATE', [req.params.id]);
        const project = projectResult.rows[0];
        if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');

        const specResult = await client.query(
          'SELECT * FROM ai_presentation.design_specs WHERE project_id = $1 ORDER BY version DESC LIMIT 1',
          [project.id]
        );
        const spec = specResult.rows[0];
        if (!spec || !spec.is_locked) {
          throw new ApiError(409, 'DESIGN_SPEC_NOT_LOCKED', 'A quote must be created (which locks the design) before production.');
        }

        const entitlementResult = await client.query(
          "SELECT * FROM ai_presentation.entitlements WHERE project_id = $1 AND status = 'active'",
          [project.id]
        );
        const entitlement = entitlementResult.rows[0];
        if (!entitlement) {
          throw new ApiError(403, 'ENTITLEMENT_REQUIRED', 'No verified payment entitlement exists for this project yet.');
        }
        if (entitlement.design_spec_id !== spec.id || entitlement.motion_tier !== spec.spec_json.motion_tier) {
          throw new ApiError(409, 'TIER_MISMATCH', 'Paid entitlement does not match the locked design specification.');
        }
        if (entitlement.motion_tier !== 'static') {
          throw new ApiError(
            501,
            'NOT_IMPLEMENTED',
            'Smooth/Cinematic production is not built yet (blocked on desktop QA — see docs/BLOCKERS.md #1).'
          );
        }
        if (!await paidProductionInput(client, { projectId: project.id, specId: spec.id,
          entitlementId: entitlement.id, ownerId: req.user!.id })) {
          throw new ApiError(409, 'PAYMENT_SNAPSHOT_MISMATCH', 'The verified payment and locked production snapshot do not match.');
        }

        const existingJob = await client.query(
          'SELECT * FROM ai_presentation.jobs WHERE project_id = $1 AND idempotency_key = $2',
          [project.id, idempotencyKey]
        );
        if (existingJob.rows.length > 0) {
          if(existingJob.rows[0].job_type!=='pptx_production'||existingJob.rows[0].design_spec_id!==spec.id||existingJob.rows[0].entitlement_id!==entitlement.id)throw new ApiError(409,'IDEMPOTENCY_KEY_CONFLICT','This request key belongs to a different job or production snapshot.');
          return { job: existingJob.rows[0], idempotent_replay: true };
        }

        const activeJob = await client.query(
          "SELECT * FROM ai_presentation.jobs WHERE project_id = $1 AND job_type = 'pptx_production' AND status IN ('queued', 'running', 'validating', 'failed') ORDER BY created_at DESC LIMIT 1",
          [project.id]
        );
        if (activeJob.rows.length > 0) {
          throw new ApiError(409, 'PRODUCTION_ALREADY_PENDING', 'A production job is already pending. Follow its status before starting another.');
        }

        const jobResult = await client.query(
          `INSERT INTO ai_presentation.jobs (project_id, owner_id, design_spec_id, entitlement_id, idempotency_key, job_type, animation_choices)
           VALUES ($1, $2, $3, $4, $5, 'pptx_production', '{}'::jsonb)
           ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
          [project.id, req.user!.id, spec.id, entitlement.id, idempotencyKey]
        );
        if (!jobResult.rows[0]) throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Use a different idempotency key for this project.');
        await client.query("UPDATE ai_presentation.projects SET state = 'producing', updated_at = NOW() WHERE id = $1", [project.id]);
        return { job: jobResult.rows[0], idempotent_replay: false, project };
      });

      // Enqueue only. A separately running worker owns generation and delivery.
      res.status(result.idempotent_replay ? 200 : 202).json({ ok: true, data: {
        job: result.job, idempotent_replay: result.idempotent_replay,
      } });
    })
  );


  // ============================================================================
  // GET /projects/:id/status
  // ============================================================================
  produceRouter.get(
    '/projects/:id/status',
    asyncRoute(async (req, res) => {
      const result = await withUserContext(req.user!.id, async (client) => {
        const projectResult = await client.query('SELECT * FROM ai_presentation.projects WHERE id = $1', [req.params.id]);
        const project = projectResult.rows[0];
        if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
        const jobResult = await client.query(
          "SELECT id, status, progress_stage, error_code, error_message, attempts, created_at, completed_at FROM ai_presentation.jobs WHERE project_id = $1 AND job_type='pptx_production' ORDER BY created_at DESC LIMIT 1",
          [project.id]
        );
        return { project_state: project.state, job: jobResult.rows[0] ?? null };
      });
      res.status(200).json({ ok: true, data: result });
    })
  );

  // ============================================================================
  // GET /projects/:id/download
  // ============================================================================
  produceRouter.get(
    '/projects/:id/download',
    asyncRoute(async (req, res) => {
      const result = await withUserContext(req.user!.id, async (client) => {
        const projectResult = await client.query('SELECT * FROM ai_presentation.projects WHERE id = $1', [req.params.id]);
        const project = projectResult.rows[0];
        if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');

        const jobResult = await client.query(
          "SELECT * FROM ai_presentation.jobs WHERE project_id = $1 AND job_type='pptx_production' AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
          [project.id]
        );
        const job = jobResult.rows[0];
        if (!job || !job.output_asset_id || job.validation_report?.passed !== true) {
          throw new ApiError(409, 'DELIVERY_BLOCKED_OR_INCOMPLETE', 'No completed, validated production exists for this project yet.');
        }
        if (!await paidProductionInput(client, { projectId: project.id, specId: job.design_spec_id,
          entitlementId: job.entitlement_id, ownerId: req.user!.id })) {
          throw new ApiError(409, 'DELIVERY_BLOCKED_OR_INCOMPLETE', 'Production access is no longer valid for this file.');
        }

        const assetResult = await client.query('SELECT * FROM ai_presentation.generated_assets WHERE id = $1', [job.output_asset_id]);
        const asset = assetResult.rows[0];
        if (!asset || asset.is_quarantined) {
          throw new ApiError(409, 'DELIVERY_BLOCKED_OR_INCOMPLETE', 'The generated asset is quarantined or missing.');
        }

        return { asset };
      });

      const url = await createSignedDownloadUrl(req.user!.accessToken, result.asset.storage_key);
      res.status(200).json({
        ok: true,
        data: {
          download_url: url,
          filename: result.asset.filename,
          mime_type: result.asset.mime_type,
          size_bytes: Number(result.asset.size_bytes),
          sha256_checksum: result.asset.sha256_checksum,
          expires_in_seconds: 900,
          compatibility_statement: 'Motion is built for desktop Microsoft PowerPoint.',
        },
      });
    })
  );

  return produceRouter;
}

export const produceRouter = createProduceRouter();
