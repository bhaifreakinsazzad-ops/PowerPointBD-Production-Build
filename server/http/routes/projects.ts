import { Router } from 'express';
import { asyncRoute, ApiError } from '../errors.ts';
import { withUserContext } from '../db.ts';
import { approvedContent,approvedSpecFields,matchesApprovedSpec } from '../approved-content.ts';
import {
  rejectForbiddenClientFields,
  requireString,
  requireIntInRange,
  optionalEnum,
  requireNullableEnum,
  requireEnum,
} from '../validation.ts';

export function createProjectsRouter(context = withUserContext) {
  const withUserContext = context;
  const projectsRouter = Router();

  const LANGUAGE_MODES = ['bilingual', 'bn', 'en'] as const;
  const INPUT_MODES = ['prompt', 'outline', 'paste'] as const;
  const MOTION_TIERS_REQUESTABLE = ['static', 'smooth'] as const; // cinematic is never directly requestable
  const TRANSITIONS = ['fade', 'wipe', 'push', 'zoom'] as const;
  const INTENSITIES = ['subtle', 'standard', 'dynamic'] as const;

  // ============================================================================
  // POST /projects
  // ============================================================================
  projectsRouter.post(
    '/projects',
    asyncRoute(async (req, res) => {
      const body = rejectForbiddenClientFields(req.body);
      const title = requireString(body, 'title', { maxLength: 200, minLength: 1 });
      const slideCount = requireIntInRange(body, 'slide_count', 1, 100);
      const languageMode = optionalEnum(body, 'language_mode', LANGUAGE_MODES, 'bilingual');
      const inputMode = optionalEnum(body, 'input_mode', INPUT_MODES, 'prompt');
      const motionTierRequested = optionalEnum(body, 'motion_tier_requested', MOTION_TIERS_REQUESTABLE, 'smooth');
      const designFamily = typeof body.design_family === 'string' ? body.design_family.slice(0, 64) : 'corporate_slate';

      const row = await withUserContext(req.user!.id, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO ai_presentation.projects
             (owner_id, title, language_mode, design_family, input_mode, slide_count, motion_tier_requested)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [req.user!.id, title, languageMode, designFamily, inputMode, slideCount, motionTierRequested]
        );
        return rows[0];
      });

      res.status(201).json({ ok: true, data: { project: row } });
    })
  );

  // ============================================================================
  // GET /projects
  // ============================================================================
  projectsRouter.get(
    '/projects',
    asyncRoute(async (req, res) => {
      const rows = await withUserContext(req.user!.id, async (client) => {
        const result = await client.query(
          'SELECT * FROM ai_presentation.projects ORDER BY created_at DESC LIMIT 100'
        );
        return result.rows;
      });
      res.status(200).json({ ok: true, data: { projects: rows } });
    })
  );

  // ============================================================================
  // GET /projects/:id
  // ============================================================================
  projectsRouter.get(
    '/projects/:id',
    asyncRoute(async (req, res) => {
      const row = await withUserContext(req.user!.id, async (client) => {
        const result = await client.query('SELECT * FROM ai_presentation.projects WHERE id = $1', [req.params.id]);
        return result.rows[0];
      });
      if (!row) {
        throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
      }
      res.status(200).json({ ok: true, data: { project: row } });
    })
  );

  // ============================================================================
  // POST /projects/:id/motion
  // ============================================================================
  projectsRouter.post(
    '/projects/:id/motion',
    asyncRoute(async (req, res) => {
      const body = rejectForbiddenClientFields(req.body);
      const motionTier = requireEnum(body, 'motion_tier', MOTION_TIERS_REQUESTABLE);

      let transitionId: (typeof TRANSITIONS)[number] | null;
      let intensity: (typeof INTENSITIES)[number] | null;
      if (motionTier === 'static') {
        if (body.transition_id !== null || body.intensity !== null) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Static tier must not specify transition_id or intensity.');
        }
        transitionId = null;
        intensity = null;
      } else {
        transitionId = requireNullableEnum(body, 'transition_id', TRANSITIONS);
        intensity = requireNullableEnum(body, 'intensity', INTENSITIES);
        if (!transitionId || !intensity) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Smooth tier requires both transition_id and intensity.');
        }
      }

      const result = await withUserContext(req.user!.id, async (client) => {
        const projectResult = await client.query('SELECT * FROM ai_presentation.projects WHERE id = $1 FOR UPDATE', [
          req.params.id,
        ]);
        const project = projectResult.rows[0];
        if (!project) {
          throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
        }
        if (['delivered', 'cancelled'].includes(project.state)) {
          throw new ApiError(409, 'INVALID_PROJECT_STATE', `Cannot configure motion while project is '${project.state}'.`);
        }

        // Versioned drafts must go through actual rendered-preview approval.
        // The legacy metadata sandbox cannot be used to sell a placeholder deck
        // as the saved customer's content while that integration is incomplete.
        const hasContent=(await client.query('SELECT 1 FROM ai_presentation.content_drafts WHERE project_id=$1 LIMIT 1', [project.id])).rowCount;
        const approved=hasContent?await approvedContent(client,project.id,req.user!.id):null;
        if (hasContent&&!approved) {
          throw new ApiError(409, 'DESIGN_APPROVAL_REQUIRED', 'Saved drafts require rendered slide previews and design approval before motion selection or checkout.');
        }

        // Fail-closed candidate gate: only motion_library rows with enabled=TRUE may be
        // selected. Right now that set is empty (no desktop QA has passed yet) so every
        // Smooth request is correctly rejected until docs/BLOCKERS.md #1 is resolved.
        if (motionTier === 'smooth') {
          const enabledCheck = await client.query(
            "SELECT 1 FROM ai_presentation.motion_library WHERE category = 'transition' AND effect_id = $1 AND enabled = TRUE",
            [transitionId]
          );
          if (enabledCheck.rows.length === 0) {
            throw new ApiError(
              409,
              'MOTION_CANDIDATE_NOT_PRODUCTION_ENABLED',
              `Transition '${transitionId}' has not passed desktop compatibility QA and cannot be sold yet (see docs/BLOCKERS.md #1).`
            );
          }
        }

        const existingSpec = await client.query(
          'SELECT * FROM ai_presentation.design_specs WHERE project_id = $1 ORDER BY version DESC LIMIT 1',
          [project.id]
        );
        const nextVersion = existingSpec.rows.length > 0 ? existingSpec.rows[0].version + 1 : 1;
        if (existingSpec.rows.length > 0 && existingSpec.rows[0].is_locked) {
          throw new ApiError(
            409,
            'DESIGN_SPEC_LOCKED',
            'This project already has a locked (quoted/paid) design specification. Motion changes after that require the revision workflow, not re-configuration.'
          );
        }

        const specJson = {
          motion_tier: motionTier,
          intensity,
          transition_id: transitionId,
          animation_policy: approved?'static-preview-source-v1':'phase0-experimental-v1',
          design_family: approved?'corporate_slate':project.design_family,
          slide_count: project.slide_count,
          ...(approved?approvedSpecFields(approved):{}),
        };

        const specResult = await client.query(
          `INSERT INTO ai_presentation.design_specs (project_id, version, is_locked, spec_json)
           VALUES ($1, $2, FALSE, $3)
           RETURNING *`,
          [project.id, nextVersion, JSON.stringify(specJson)]
        );

        const updatedProject = await client.query(
          `UPDATE ai_presentation.projects
           SET motion_tier_requested = $1, state = 'motion_configured', updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [motionTier, project.id]
        );

        return { project: updatedProject.rows[0], design_spec: specResult.rows[0] };
      });

      res.status(200).json({ ok: true, data: result });
    })
  );

  // ============================================================================
  // POST /projects/:id/quote — server-authoritative, integer-paisa, immutable snapshot
  // ============================================================================
  projectsRouter.post(
    '/projects/:id/quote',
    asyncRoute(async (req, res) => {
      rejectForbiddenClientFields(req.body ?? {});

      const result = await withUserContext(req.user!.id, async (client) => {
        const projectResult = await client.query('SELECT * FROM ai_presentation.projects WHERE id = $1 FOR UPDATE', [
          req.params.id,
        ]);
        const project = projectResult.rows[0];
        if (!project) {
          throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
        }
        if (!['motion_configured', 'quoted', 'payment_pending', 'payment_failed'].includes(project.state)) {
          throw new ApiError(409, 'INVALID_PROJECT_STATE', 'This project cannot create another quote in its current state.');
        }

        const hasContent=(await client.query('SELECT 1 FROM ai_presentation.content_drafts WHERE project_id=$1 LIMIT 1', [project.id])).rowCount;
        const approved=hasContent?await approvedContent(client,project.id,req.user!.id):null;
        if (hasContent&&!approved) {
          throw new ApiError(409, 'DESIGN_APPROVAL_REQUIRED', 'Approve rendered slide previews before requesting a quote for saved content.');
        }

        const specResult = await client.query(
          'SELECT * FROM ai_presentation.design_specs WHERE project_id = $1 ORDER BY version DESC LIMIT 1',
          [project.id]
        );
        const spec = specResult.rows[0];
        if (!spec) {
          throw new ApiError(409, 'MOTION_NOT_CONFIGURED', 'Configure motion (POST /projects/:id/motion) before requesting a quote.');
        }
        if(approved&&!matchesApprovedSpec(spec.spec_json,approved))throw new ApiError(409,'DESIGN_SNAPSHOT_MISMATCH','The design specification does not match the approved preview.');

        const tier = spec.spec_json.motion_tier as 'static' | 'smooth' | 'cinematic';
        if (tier === 'cinematic') {
          throw new ApiError(403, 'CINEMATIC_TIER_DISABLED', 'Cinematic is not available for quoting yet.');
        }

        const priceConfigResult = await client.query(
          'SELECT * FROM ai_presentation.price_configs WHERE is_active = TRUE ORDER BY version DESC LIMIT 1'
        );
        const priceConfig = priceConfigResult.rows[0];
        if (!priceConfig) {
          throw new ApiError(503, 'NO_ACTIVE_PRICE_CONFIG', 'No active pricing configuration exists.');
        }

        const slideCount: number = spec.is_locked||approved ? spec.spec_json.slide_count : project.slide_count;
        if (!Number.isInteger(slideCount) || slideCount < 1 || slideCount > 100
            || (spec.is_locked && (!spec.spec_json.title || !['bn','en','bilingual'].includes(spec.spec_json.language_mode)))) {
          throw new ApiError(409, 'DESIGN_SNAPSHOT_INCOMPLETE', 'A complete locked production snapshot is required.');
        }
        const baseRateBdt: number = priceConfig.base_rate_bdt;
        const motionRateBdt: number = tier === 'smooth' ? priceConfig.smooth_rate_bdt : 0;
        const baseSubtotalBdt = slideCount * baseRateBdt;
        const motionSubtotalBdt = slideCount * motionRateBdt;
        const totalBdt = baseSubtotalBdt + motionSubtotalBdt;
        const totalPaisa = totalBdt * 100;

        const breakdown = {
          currency: 'BDT',
          pricing_config_version: priceConfig.version,
          slide_count: slideCount,
          tier,
          base_rate_per_slide_bdt: baseRateBdt,
          motion_rate_per_slide_bdt: motionRateBdt,
          base_subtotal_bdt: baseSubtotalBdt,
          motion_subtotal_bdt: motionSubtotalBdt,
          total_amount_bdt: totalBdt,
          total_amount_paisa: totalPaisa,
          formula_applied: `${slideCount} slides * (BDT ${baseRateBdt}${motionRateBdt ? ` + BDT ${motionRateBdt}` : ''}) = BDT ${totalBdt}`,
          compatibility_statement: 'Motion is built for desktop Microsoft PowerPoint.',
        };

        // Supersede any previous active quote for this project (lifecycle-only
        // change; the monetary-snapshot trigger still blocks tampering with the
        // superseded row's own amount/breakdown fields).
        await client.query(
          "UPDATE ai_presentation.quotes SET status = 'superseded' WHERE project_id = $1 AND status = 'active'",
          [project.id]
        );

        // Lock the design spec now that a quote is bound to it (first-time lock
        // is allowed by the immutability trigger; re-locking an already-locked
        // spec with different content is not).
        if (!spec.is_locked) {
          await client.query(`UPDATE ai_presentation.design_specs SET spec_json = spec_json || jsonb_build_object('title', $2::text, 'language_mode', $3::text, 'slide_count', $4::integer), is_locked = TRUE, locked_at = NOW() WHERE id = $1`, [
            spec.id, approved?.content.title??project.title, approved?.content.language??project.language_mode, slideCount,
          ]);
        }

        const quoteResult = await client.query(
          `INSERT INTO ai_presentation.quotes
             (project_id, owner_id, design_spec_id, pricing_config_version, tier, slide_count,
              base_rate_bdt, motion_rate_bdt, quote_amount, quote_amount_paisa, quote_breakdown, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + ($12 || ' hours')::INTERVAL)
           RETURNING *`,
          [
            project.id,
            req.user!.id,
            spec.id,
            priceConfig.version,
            tier,
            slideCount,
            baseRateBdt,
            motionRateBdt,
            totalBdt,
            totalPaisa,
            JSON.stringify(breakdown),
            priceConfig.quote_ttl_hours,
          ]
        );

        const updatedProject = await client.query(
          "UPDATE ai_presentation.projects SET state = 'quoted', updated_at = NOW() WHERE id = $1 RETURNING *",
          [project.id]
        );

        return { quote: quoteResult.rows[0], project: updatedProject.rows[0] };
      });

      res.status(201).json({ ok: true, data: result });
    })
  );

  return projectsRouter;
}

export const projectsRouter = createProjectsRouter();
