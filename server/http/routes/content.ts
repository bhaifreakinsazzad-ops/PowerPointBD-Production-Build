import { Router } from 'express';
import { withUserContext } from '../db.ts';
import { asyncRoute, ApiError } from '../errors.ts';
import { rejectForbiddenClientFields, requireIntInRange } from '../validation.ts';
import { validatePresentation } from '../../../shared/presentation.ts';

/** Persist reviewed text, without conferring design approval or production rights. */
export function createContentRouter(context = withUserContext) {
  const router = Router();
  router.param('id', (_req, _res, next, id: string) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      next(new ApiError(400, 'INVALID_PROJECT_ID', 'A valid project ID is required.'));
    } else next();
  });
  router.get('/projects/:id/content', asyncRoute(async (req, res) => {
    const data = await context(req.user!.id, async (db) => {
      const project = await db.query('SELECT id FROM ai_presentation.projects WHERE id=$1 AND owner_id=$2', [req.params.id, req.user!.id]);
      if (!project.rowCount) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
      try {
        const result = await db.query('SELECT version,content,created_at FROM ai_presentation.content_drafts WHERE project_id=$1 ORDER BY version DESC LIMIT 1', [req.params.id]);
        return { draft: result.rows[0] ?? null };
      } catch (err: any) {
        if (err.code === '42P01') return { draft: null };
        throw err;
      }
    });
    res.json({ ok: true, data });
  }));
  router.put('/projects/:id/content', asyncRoute(async (req, res) => {
    const body = rejectForbiddenClientFields(req.body);
    const expected = requireIntInRange(body, 'expected_version', 0, 2147483646);
    let content;
    try { content = validatePresentation(body.content); }
    catch { throw new ApiError(400, 'CONTENT_VALIDATION_FAILED', 'Supply a valid presentation draft.'); }
    const data = await context(req.user!.id, async (db) => {
      const project = (await db.query('SELECT * FROM ai_presentation.projects WHERE id=$1 AND owner_id=$2 FOR UPDATE', [req.params.id, req.user!.id])).rows[0];
      if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
      const locked = await db.query('SELECT id FROM ai_presentation.design_specs WHERE project_id=$1 AND is_locked LIMIT 1', [project.id]);
      if (!['draft','preview_revision_requested'].includes(project.state) || locked.rowCount) throw new ApiError(409, 'CONTENT_DRAFT_LOCKED', 'This project has entered design or checkout. A revision workflow is required.');
      let latest: any = null;
      try {
        latest = (await db.query('SELECT version,content,created_at FROM ai_presentation.content_drafts WHERE project_id=$1 ORDER BY version DESC LIMIT 1', [project.id])).rows[0];
      } catch (err: any) {
        if (err.code !== '42P01') throw err;
      }
      // Identical network retries return the already saved version. Any different
      // concurrent edit receives a conflict; never silently overwrite it.
      const normalized = JSON.stringify(content);
      const equal = latest && JSON.stringify(validatePresentation(latest.content)) === normalized;
      if (latest?.version === expected + 1 && equal) return { draft: latest, replay: true };
      if ((latest?.version ?? 0) !== expected) throw new ApiError(409, 'CONTENT_VERSION_CONFLICT', 'A newer draft exists. Reload it before saving your edits.');
      if (equal) return { draft: latest, replay: true };
      try {
        const result = await db.query('INSERT INTO ai_presentation.content_drafts(project_id,version,content) VALUES($1,$2,$3) RETURNING version,content,created_at', [project.id, expected + 1, normalized]);
        await db.query('UPDATE ai_presentation.projects SET title=$2,language_mode=$3,slide_count=$4,updated_at=now() WHERE id=$1', [project.id, content.title, content.language, content.slides.length]);
        return { draft: result.rows[0], replay: false };
      } catch (err: any) {
        if (err.code === '42P01') {
          await db.query('UPDATE ai_presentation.projects SET title=$2,language_mode=$3,slide_count=$4,updated_at=now() WHERE id=$1', [project.id, content.title, content.language, content.slides.length]);
          return { draft: { version: expected + 1, content, created_at: new Date().toISOString() }, replay: false };
        }
        throw err;
      }
    });
    res.status(data.replay ? 200 : 201).json({ ok: true, data });
  }));
  return router;
}
export const contentRouter = createContentRouter();
